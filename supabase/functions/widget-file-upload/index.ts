import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Server-side allowlist — authoritative. Client `accept=` attribute is advisory only.
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

// Sanitise a filename: keep letters, digits, dot, dash, underscore; truncate to 80 chars; preserve extension
function sanitiseFilename(name: string): string {
  const parts = name.split('.');
  const ext = parts.length > 1 ? '.' + parts.pop() : '';
  const base = parts.join('.') || 'file';
  const cleanBase = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80 - ext.length);
  const cleanExt = ext.replace(/[^a-zA-Z0-9.]/g, '');
  return cleanBase + cleanExt;
}

// Classify a MIME type into one of four render kinds
function classifyKind(mimeType: string): 'image' | 'video' | 'audio' | 'file' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let uploadedStoragePath: string | null = null;

  try {
    // ---- Parse multipart form ----
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const agentId = formData.get('agentId') as string | null;
    const conversationId = formData.get('conversationId') as string | null;
    const userId = formData.get('userId') as string | null;
    const voiceflowSessionId = formData.get('voiceflowSessionId') as string | null;
    const caption = (formData.get('text') as string | null) ?? '';
    const isTestMode = formData.get('isTestMode') === 'true';

    // Two-phase commit: when the widget already pre-uploaded the file via
    // widget-stage-upload, it sends the resulting attachment metadata as JSON
    // here instead of a fresh `file`. We trust this since both endpoints share
    // the same anonymous-customer trust boundary and the same allowlist gate.
    const stagedAttachmentRaw = formData.get('stagedAttachment') as string | null;
    let stagedAttachment: any = null;
    if (stagedAttachmentRaw) {
      try {
        stagedAttachment = JSON.parse(stagedAttachmentRaw);
      } catch {
        return new Response(
          JSON.stringify({ error: 'Bad stagedAttachment', message: 'stagedAttachment must be valid JSON.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if ((!file && !stagedAttachment) || !agentId || !userId) {
      throw new Error('Missing required fields: (file or stagedAttachment), agentId, userId');
    }

    let attachment: { url: string; fileName: string; mimeType: string; size: number; kind: string };

    if (stagedAttachment) {
      // ---- Path B: file already in storage (staged by widget-stage-upload) ----
      if (
        typeof stagedAttachment.url !== 'string' ||
        typeof stagedAttachment.fileName !== 'string' ||
        typeof stagedAttachment.mimeType !== 'string' ||
        typeof stagedAttachment.size !== 'number' ||
        typeof stagedAttachment.kind !== 'string'
      ) {
        return new Response(
          JSON.stringify({ error: 'Bad stagedAttachment', message: 'stagedAttachment is missing required fields.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Belt-and-braces: re-validate MIME against allowlist on the commit path
      // so a tampered client can't sneak through with a forbidden type.
      if (!ALLOWED_MIME_TYPES.has(stagedAttachment.mimeType)) {
        return new Response(
          JSON.stringify({ error: 'File type not allowed', message: 'This file type is not supported.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      attachment = {
        url: stagedAttachment.url,
        fileName: stagedAttachment.fileName,
        mimeType: stagedAttachment.mimeType,
        size: stagedAttachment.size,
        kind: stagedAttachment.kind as 'image' | 'video' | 'audio' | 'file',
      };
    } else {
      // ---- Path A: legacy single-call (file in this request's body) ----
      // ---- Validate file ----
      if (file!.size > MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({ error: 'File too large', message: 'Files must be under 10MB.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!ALLOWED_MIME_TYPES.has(file!.type)) {
        return new Response(
          JSON.stringify({ error: 'File type not allowed', message: 'This file type is not supported.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ---- Validate agent is active ----
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id, status')
        .eq('id', agentId)
        .single();

      if (agentError || !agent) {
        throw new Error('Agent not found');
      }
      if (agent.status !== 'active') {
        throw new Error('Agent is not active');
      }

      // ---- Upload to storage ----
      const sanitised = sanitiseFilename(file!.name);
      const timestamp = Date.now();
      // If there's no conversationId yet (first message in a new chat), bucket it under 'new'.
      // The path is not used to look files up — it's just for organisation.
      const convFolder = conversationId || 'new';
      const storagePath = `${agentId}/${convFolder}/${timestamp}-${sanitised}`;

      const fileBytes = new Uint8Array(await file!.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, fileBytes, {
          contentType: file!.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('[widget-file-upload] Storage upload failed:', uploadError);
        throw new Error('Upload failed: ' + uploadError.message);
      }

      uploadedStoragePath = storagePath;

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

      const publicUrl = publicUrlData.publicUrl;
      const kind = classifyKind(file!.type);

      attachment = {
        url: publicUrl,
        fileName: file!.name, // original filename for display (not sanitised)
        mimeType: file!.type,
        size: file!.size,
        kind,
      };
    }

    const publicUrl = attachment.url;

    // ---- Forward to voiceflow-interact so the AI sees the message + URL ----
    // voiceflow-interact is responsible for writing the transcript row. We pass
    // the attachment through so it can attach it to the row it writes.
    //
    // Message body sent to Voiceflow: caption + "\n" + URL (so AI has context).
    // Transcript text stored: caption only (attachment rendered from the
    // attachments column, no need to duplicate the URL in text).
    const vfMessageBody = caption
      ? `${caption}\n${publicUrl}`
      : publicUrl;

    const { data: vfResponse, error: vfError } = await supabase.functions.invoke(
      'voiceflow-interact',
      {
        body: {
          agentId,
          userId,
          baseUserId: userId.split('_')[0] || userId,
          message: vfMessageBody,
          action: 'text',
          conversationId: conversationId || null,
          isTestMode,
          // NEW: passed through so voiceflow-interact can persist it on the transcript row
          attachments: [attachment],
          transcriptTextOverride: caption, // store caption only (without URL) in transcripts.text
        },
      }
    );

    if (vfError || !vfResponse) {
      console.error('[widget-file-upload] voiceflow-interact failed:', vfError);
      throw new Error('Failed to send message: ' + (vfError?.message || 'unknown'));
    }

    // ---- Success — return voiceflow-interact's full response to the caller ----
    // Also include the attachment details at the top level for convenience,
    // and legacy `fileName`/`publicUrl` keys for any older callers.
    return new Response(
      JSON.stringify({
        ...vfResponse,
        attachment,
        // Legacy fields (kept for backwards compat with older widget deploys):
        fileName: attachment.fileName,
        publicUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // ---- Roll back storage upload on any failure after the upload succeeded ----
    if (uploadedStoragePath) {
      const { error: deleteError } = await supabase.storage
        .from(BUCKET)
        .remove([uploadedStoragePath]);
      if (deleteError) {
        console.error('[widget-file-upload] Rollback delete failed:', deleteError, 'Path:', uploadedStoragePath);
        // We log but don't surface — the upstream error is more useful to the caller.
      } else {
        console.log('[widget-file-upload] Rolled back storage upload:', uploadedStoragePath);
      }
    }

    console.error('[widget-file-upload] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
