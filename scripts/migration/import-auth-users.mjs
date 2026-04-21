import './lib/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { importAuthUsers } from './lib/auth-importer.js';
import { closePgAdmin } from './lib/client.js';

const CSV_DIR = process.env.CSV_EXPORT_DIR;
if (!CSV_DIR) {
  console.error('CSV_EXPORT_DIR not set in .env.migration');
  process.exit(1);
}

const files = fs.readdirSync(CSV_DIR)
  .filter((f) => f.startsWith('auth_users-export-') && f.endsWith('.csv'));
if (files.length === 0) {
  console.error(`No auth_users-export-*.csv found in ${CSV_DIR}`);
  console.error('Rename the exported CSV to match this pattern and re-run.');
  process.exit(1);
}
if (files.length > 1) {
  console.warn(`Multiple auth_users exports found — using newest: ${files.sort().pop()}`);
}
const csvPath = path.join(CSV_DIR, files.sort().pop());

const truncate = process.argv.includes('--truncate');
console.log(`[auth] Importing from ${csvPath}${truncate ? ' (with --truncate)' : ''}`);

try {
  await importAuthUsers(csvPath, { truncate });
  console.log('[auth] Done.');
} finally {
  await closePgAdmin();
}
