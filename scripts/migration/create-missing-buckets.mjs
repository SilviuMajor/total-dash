import { newSupabase, getPgAdmin, closePgAdmin } from './lib/client.js';

const BUCKETS = {
  avatars: {
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    fileSizeLimit: 5 * 1024 * 1024,
  },
  'widget-attachments': {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
      'video/mp4', 'video/quicktime', 'video/webm',
      'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
      'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/x-7z-compressed',
    ],
  },
};

async function main() {
  const { data: existing, error: listErr } = await newSupabase.storage.listBuckets();
  if (listErr) throw listErr;
  const existingNames = new Set((existing ?? []).map((b) => b.name));

  for (const [name, opts] of Object.entries(BUCKETS)) {
    if (existingNames.has(name)) {
      console.log(`${name}: already exists, skipping`);
    } else {
      const { error } = await newSupabase.storage.createBucket(name, opts);
      if (error) {
        console.error(`${name}: create failed — ${error.message}`);
        throw error;
      }
      console.log(`${name}: created`);
    }
  }

  const pg = await getPgAdmin();
  for (const name of Object.keys(BUCKETS)) {
    const policyName = `Public read for ${name}`;
    const sql = `CREATE POLICY "${policyName}" ON storage.objects FOR SELECT USING (bucket_id = '${name}');`;
    try {
      await pg.query(sql);
      console.log(`${name}: public-read policy created`);
    } catch (e) {
      if (/already exists/i.test(e.message)) {
        console.log(`${name}: public-read policy already exists, skipping`);
      } else {
        console.error(`${name}: policy create failed — ${e.message}`);
        throw e;
      }
    }
  }

  await closePgAdmin();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
