import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Server-side allowlist — authoritative. Keep in sync with widget-file-upload.
const ALLOWED_MIME_TYPES = new Set<string>([
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  // Video
  'video/mp4', 'video/webm', 'video/quicktime',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  // Archives
  'application/zip',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const BUCKET = 'widget-attachments';

function sanitiseFilename(name: string): string {
  const parts = name.split('.');
  const ext = parts.length > 1 ? '.' + parts.pop() : '';
  const base = parts.join('.') || 'file';
  const cleanBase = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80 - ext.length);
  const cleanExt = ext.replace(/[^a-zA-Z0-9.]/g, '');
  return cleanBase + cleanExt;
}

function classifyKind(mimeType: string): 'image' | 'video' | 'audio' | 'file' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // service-role client for writes/bypass RLS + JWT verification
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let uploadedStoragePath: string | null = null;

  try {
    // ---- Identify the caller via JWT ----
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '').trim();
    if (!jwt) {
      return jsonResponse({ error: 'Unauthorized', message: 'Missing auth token.' }, 401);
    }

    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(jwt);
    if (authError || !caller) {
      return jsonResponse({ error: 'Unauthorized', message: 'Invalid auth token.' }, 401);
    }

    // ---- Parse multipart form ----
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string | null;
    const caption = (formData.get('text') as string | null) ?? '';
    // The frontend resolves the acting client_user via its loadClientUser hook
    // (which itself supports preview/impersonation fallback) and passes the
    // resulting client_users.id here. We then verify the JWT caller is allowed
    // to act as that client_user — same trust model as handover-actions.
    const claimedClientUserId = formData.get('clientUserId') as string | null;

    if (!file || !conversationId || !claimedClientUserId) {
      return jsonResponse(
        { error: 'Missing fields', message: 'file, conversationId and clientUserId are required.' },
        400
      );
    }

    // ---- Validate file ----
    if (file.size > MAX_FILE_SIZE) {
      return jsonResponse(
        { error: 'File too large', message: 'Files must be under 10MB.' },
        400
      );
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return jsonResponse(
        { error: 'File type not allowed', message: 'This file type is not supported.' },
        400
      );
    }

    // ---- Authorisation: confirm caller can act as the claimed client_user ----
    // Three valid paths (mirrors handover-actions):
    //   1. The caller IS the client_user behind that id (auth.uid matches client_users.user_id)
    //   2. The caller is a super admin
    //   3. The caller is an agency_user whose agency owns the target client
    let authorised = false;

    // Path 1
    const { data: ownClientUserRow } = await adminClient
      .from('client_users')
      .select('id')
      .eq('user_id', caller.id)
      .eq('id', claimedClientUserId)
      .maybeSingle();

    if (ownClientUserRow) {
      authorised = true;
    } else {
      // Path 2: super admin
      const { data: isSuperAdmin } = await adminClient.rpc('is_super_admin', { _user_id: caller.id });
      if (isSuperAdmin) {
        authorised = true;
      } else {
        // Path 3: agency user with access to the client behind the target client_user
        const { data: targetClientUser } = await adminClient
          .from('client_users')
          .select('client_id')
          .eq('id', claimedClientUserId)
          .maybeSingle();
        if (targetClientUser) {
          const { data: targetClient } = await adminClient
            .from('clients')
            .select('agency_id')
            .eq('id', targetClientUser.client_id)
            .maybeSingle();
          const { data: callerAgencyAccess } = await adminClient
            .from('agency_users')
            .select('agency_id')
            .eq('user_id', caller.id)
            .eq('agency_id', targetClient?.agency_id ?? '')
            .maybeSingle();
          if (callerAgencyAccess) authorised = true;
        }
      }
    }

    if (!authorised) {
      return jsonResponse(
        { error: 'Forbidden', message: 'Not authorised to act as this client user.' },
        403
      );
    }

    // ---- Resolve the acting client_user row (we know it exists from auth above) ----
    const { data: clientUser, error: cuError } = await adminClient
      .from('client_users')
      .select('id, client_id, user_id')
      .eq('id', claimedClientUserId)
      .single();

    if (cuError || !clientUser) {
      return jsonResponse(
        { error: 'Forbidden', message: 'Acting client user not found.' },
        403
      );
    }

    // Display name: prefer the *acting* user's profile (the one being impersonated
    // in preview mode), not the JWT caller's profile. Falls back to caller if
    // the acting user has no profile row.
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', clientUser.user_id)
      .single();

    const agentName =
      (profile?.full_name && profile.full_name.trim()) ||
      profile?.email ||
      'Support';

    // ---- Verify caller has access to the conversation ----
    // Conversation must belong to an agent assigned to this caller's client.
    const { data: conv, error: convError } = await adminClient
      .from('conversations')
      .select('id, agent_id, status, owner_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conv) {
      return jsonResponse(
        { error: 'Not found', message: 'Conversation not found.' },
        404
      );
    }

    // Check the conversation's agent is assigned to the caller's client.
    // Agents → clients is a many-to-many through agent_assignments — there is
    // no client_id column on agents directly. (The earlier select for
    // 'id, client_id, status' on agents was always returning a PostgREST
    // error because client_id doesn't exist, which surfaced as the
    // "Agent not accessible" toast.)
    const { data: assignment, error: assignmentError } = await adminClient
      .from('agent_assignments')
      .select('id')
      .eq('agent_id', conv.agent_id)
      .eq('client_id', clientUser.client_id)
      .maybeSingle();

    if (assignmentError) {
      console.error('[agent-file-upload] agent_assignments lookup failed:', assignmentError);
      return jsonResponse(
        { error: 'Forbidden', message: 'Could not verify agent access.' },
        403
      );
    }
    if (!assignment) {
      return jsonResponse(
        { error: 'Forbidden', message: 'You do not have access to this conversation.' },
        403
      );
    }

    // Only the current owner (the agent in active handover) can send attachments.
    // If there's no owner yet (pending/waiting) or someone else owns it, reject.
    if (conv.owner_id !== clientUser.id) {
      return jsonResponse(
        {
          error: 'Forbidden',
          message:
            'Only the agent currently handling this conversation can send attachments.',
        },
        403
      );
    }

    // ---- Upload to storage ----
    const sanitised = sanitiseFilename(file.name);
    const timestamp = Date.now();
    const storagePath = `${conv.agent_id}/${conversationId}/${timestamp}-${sanitised}`;

    const fileBytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await adminClient.storage
      .from(BUCKET)
      .upload(storagePath, fileBytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[agent-file-upload] Storage upload failed:', uploadError);
      throw new Error('Upload failed: ' + uploadError.message);
    }

    uploadedStoragePath = storagePath;

    const { data: publicUrlData } = adminClient.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData.publicUrl;
    const kind = classifyKind(file.type);

    const attachment = {
      url: publicUrl,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      kind,
    };

    // ---- Write the transcript row ----
    // speaker: 'client_user' — this is an agent message (as rendered by the widget
    // during handover polling and by the Conversations transcript panel).
    const { data: transcriptRow, error: transcriptError } = await adminClient
      .from('transcripts')
      .insert({
        conversation_id: conversationId,
        speaker: 'client_user',
        text: caption, // may be empty string; attachment carries the content
        attachments: [attachment],
        metadata: {
          client_user_id: clientUser.id,
          client_user_name: agentName,
        },
      })
      .select()
      .single();

    if (transcriptError || !transcriptRow) {
      console.error('[agent-file-upload] Transcript insert failed:', transcriptError);
      throw new Error('Failed to write message: ' + (transcriptError?.message ?? 'unknown'));
    }

    // ---- Bump conversation activity so the list re-sorts ----
    // Non-blocking — if this fails, the message is still written. Log and move on.
    const { error: convUpdateError } = await adminClient
      .from('conversations')
      .update({
        last_activity_at: new Date().toISOString(),
        // Agent replied → clear any unanswered-customer-message clock
        first_unanswered_message_at: null,
      })
      .eq('id', conversationId);

    if (convUpdateError) {
      console.warn('[agent-file-upload] Conversation update failed (non-fatal):', convUpdateError);
    }

    return jsonResponse(
      {
        success: true,
        attachment,
        transcript: transcriptRow,
      },
      200
    );
  } catch (error) {
    // Roll back the storage upload if it succeeded but a later step failed
    if (uploadedStoragePath) {
      const { error: deleteError } = await adminClient.storage
        .from(BUCKET)
        .remove([uploadedStoragePath]);
      if (deleteError) {
        console.error(
          '[agent-file-upload] Rollback delete failed:',
          deleteError,
          'Path:',
          uploadedStoragePath
        );
      } else {
        console.log('[agent-file-upload] Rolled back storage upload:', uploadedStoragePath);
      }
    }

    console.error('[agent-file-upload] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: errorMessage }, 500);
  }
});
