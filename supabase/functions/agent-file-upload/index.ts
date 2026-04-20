import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  // service-role client for writes/bypass RLS
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let uploadedStoragePath: string | null = null;

  try {
    // ---- Identify the caller via JWT ----
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '').trim();
    if (!jwt) {
      return jsonResponse({ error: 'Unauthorized', message: 'Missing auth token.' }, 401);
    }

    // Verify the JWT and get the auth user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !authUser) {
      return jsonResponse({ error: 'Unauthorized', message: 'Invalid auth token.' }, 401);
    }

    // ---- Parse multipart form ----
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string | null;
    const caption = (formData.get('text') as string | null) ?? '';

    if (!file || !conversationId) {
      return jsonResponse(
        { error: 'Missing fields', message: 'file and conversationId are required.' },
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

    // ---- Resolve caller to a client_users row ----
    // Profiles link auth users to their profile; client_users is the agent record
    // linked to that profile for a specific client.
    const { data: clientUser, error: cuError } = await adminClient
      .from('client_users')
      .select('id, client_id, profile_id, status')
      .eq('profile_id', authUser.id)
      .single();

    if (cuError || !clientUser) {
      return jsonResponse(
        { error: 'Forbidden', message: 'No client_user record for this account.' },
        403
      );
    }
    if (clientUser.status === 'suspended') {
      return jsonResponse(
        { error: 'Forbidden', message: 'Account is suspended.' },
        403
      );
    }

    // Get the caller's display name for transcript metadata
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', authUser.id)
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

    // Check the conversation's agent belongs to the caller's client
    const { data: agentRow, error: agentError } = await adminClient
      .from('agents')
      .select('id, client_id, status')
      .eq('id', conv.agent_id)
      .single();

    if (agentError || !agentRow) {
      return jsonResponse(
        { error: 'Forbidden', message: 'Agent not accessible.' },
        403
      );
    }
    if (agentRow.client_id !== clientUser.client_id) {
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
