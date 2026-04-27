// widget-stage-upload — anonymous, customer-side. Upload-only.
//
// Phase 1 of the new 2-phase widget attachment flow:
//   - Customer picks a file in the widget → this endpoint uploads it to
//     storage and returns the public URL + metadata (the "staged" attachment).
//   - The widget keeps the staged attachment in client memory until the user
//     presses Send.
//   - On Send, widget-file-upload is called with `stagedAttachment` (JSON)
//     instead of `file`; that endpoint skips the upload step and just commits
//     the transcript via voiceflow-interact (with the optional caption).
//
// Why split: the user wants the upload progress to start on pick (so it's
// fast when they hit Send) but the message bubble to land only when they press
// Send (so they can attach a caption). The previous single-call atomic flow
// wrote the transcript on pick, which posted the bubble immediately.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Server-side allowlist — authoritative. Mirrors widget-file-upload.
const ALLOWED_MIME_TYPES = new Set<string>([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  'application/zip',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const BUCKET = 'widget-attachments';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const agentId = formData.get('agentId') as string | null;
    const conversationId = formData.get('conversationId') as string | null;

    if (!file || !agentId) {
      return jsonResponse({ error: 'Missing fields', message: 'file and agentId are required.' }, 400);
    }
    if (typeof agentId !== 'string' || !UUID_RE.test(agentId)) {
      return jsonResponse({ error: 'Bad agentId', message: 'agentId must be a UUID.' }, 400);
    }
    if (file.size > MAX_FILE_SIZE) {
      return jsonResponse({ error: 'File too large', message: 'Files must be under 10MB.' }, 400);
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return jsonResponse({ error: 'File type not allowed', message: 'This file type is not supported.' }, 400);
    }

    // Validate agent exists + active. Cheap guard against random agent IDs being
    // used to dump junk into our storage bucket.
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, status')
      .eq('id', agentId)
      .single();
    if (agentError || !agent) {
      return jsonResponse({ error: 'Agent not found' }, 404);
    }
    if (agent.status !== 'active') {
      return jsonResponse({ error: 'Agent not active' }, 403);
    }

    const sanitised = sanitiseFilename(file.name);
    const timestamp = Date.now();
    // Bucket folder layout matches widget-file-upload so commits land in the
    // same place as legacy single-call uploads. `staged` folder is used when
    // the conversation hasn't been created yet.
    const convFolder = conversationId || 'staged';
    const storagePath = `${agentId}/${convFolder}/${timestamp}-${sanitised}`;

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[widget-stage-upload] Storage upload failed:', uploadError);
      return jsonResponse({ error: 'Upload failed', message: uploadError.message }, 500);
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl;
    const kind = classifyKind(file.type);

    const attachment = {
      url: publicUrl,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      kind,
      storagePath, // returned so the widget can pass it back to widget-file-upload for cleanup-on-cancel if we ever add that path
    };

    return jsonResponse({ success: true, attachment }, 200);
  } catch (error) {
    console.error('[widget-stage-upload] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: errorMessage }, 500);
  }
});
