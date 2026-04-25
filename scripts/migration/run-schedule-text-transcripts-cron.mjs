import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pgAdmin, closePgAdmin } from './lib/client.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(here, 'schedule-text-transcripts-cron.sql');

const anonKey = process.argv[2];
if (!anonKey) {
  console.error('Usage: node run-schedule-text-transcripts-cron.mjs <NEW_PROJECT_ANON_KEY>');
  console.error('The anon key is substituted into the cron job body in memory only.');
  process.exit(1);
}

// Sanity check: JWTs are three base64url-ish segments separated by dots.
if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(anonKey)) {
  console.error('Refusing to proceed: the provided value does not look like a JWT (expected three dot-separated segments).');
  process.exit(1);
}

const template = fs.readFileSync(sqlPath, 'utf8');
const scheduleSql = template.replaceAll(':ANON_KEY', anonKey);

try {
  console.log('Applying cron schedule for create-text-transcripts-hourly...');
  await pgAdmin.query(scheduleSql);
  console.log('  schedule applied.');

  console.log('Verifying cron.job entry...');
  const res = await pgAdmin.query(
    `SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'create-text-transcripts-hourly';`
  );
  if (res.rows.length !== 1) {
    console.error(`  expected 1 row, got ${res.rows.length}`);
    process.exitCode = 1;
  } else {
    console.log('  OK:', res.rows[0]);
  }

  console.log('\nDone. Next run fires at the top of the next hour.');
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  await closePgAdmin();
}
