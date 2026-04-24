import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pgAdmin, closePgAdmin } from './lib/client.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(here, 'schedule-text-transcripts-cron.sql');

const anonKey = process.argv[2];
if (!anonKey) {
  console.error('Usage: node run-schedule-text-transcripts-cron.mjs <NEW_PROJECT_ANON_KEY>');
  console.error('The anon key will be set as a database-level setting (app.settings.anon_key)');
  console.error('and referenced from the scheduled cron job. It is never written to disk.');
  process.exit(1);
}

// Sanity check: JWTs are three base64url-ish segments separated by dots.
if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(anonKey)) {
  console.error('Refusing to proceed: the provided value does not look like a JWT (expected three dot-separated segments).');
  process.exit(1);
}

const scheduleSql = fs.readFileSync(sqlPath, 'utf8');

try {
  console.log('Step 1: storing anon key in app.settings.anon_key on postgres database...');
  // ALTER DATABASE does not support parameterised values for SET, so we have to
  // interpolate — safe here because we validated the prefix and the key is
  // provided at the CLI, not from user input on the web.
  const escaped = anonKey.replace(/'/g, "''");
  await pgAdmin.query(`ALTER DATABASE postgres SET app.settings.anon_key = '${escaped}';`);
  console.log('  anon key stored.');

  console.log('Step 2: applying schedule-text-transcripts-cron.sql...');
  await pgAdmin.query(scheduleSql);
  console.log('  schedule applied.');

  console.log('Step 3: verifying cron.job entry...');
  const res = await pgAdmin.query(
    `SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'create-text-transcripts-hourly';`
  );
  if (res.rows.length !== 1) {
    console.error(`  expected 1 row, got ${res.rows.length}`);
    process.exitCode = 1;
  } else {
    console.log('  OK:', res.rows[0]);
  }

  console.log('\nDone. Note: the anon key setting takes effect on new database sessions.');
  console.log('pg_cron runs in its own sessions, so the next scheduled run will pick it up.');
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  await closePgAdmin();
}
