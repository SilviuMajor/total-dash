import './lib/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { runImport } from './lib/importer.js';
import { closePgAdmin } from './lib/client.js';

const CSV_DIR = process.env.CSV_EXPORT_DIR;
if (!CSV_DIR) {
  console.error('CSV_EXPORT_DIR not set in .env.migration');
  process.exit(1);
}

const truncate = process.argv.includes('--truncate');

const TABLES_IN_ORDER = [
  'agencies',
  'agency_settings',
  'clients',
  'client_settings',
  'profiles',
  'super_admin_users',
  'agency_users',
  'client_users',
];

function findCsvForTable(tableName) {
  const files = fs
    .readdirSync(CSV_DIR)
    .filter((f) => f.startsWith(`${tableName}-export-`) && f.endsWith('.csv'))
    .sort();
  if (files.length === 0) return null;
  if (files.length > 1) {
    console.warn(`[${tableName}] Multiple exports found — using newest: ${files[files.length - 1]}`);
  }
  return path.join(CSV_DIR, files[files.length - 1]);
}

console.log(`[tenant] Starting B3 tenant hierarchy import${truncate ? ' (--truncate)' : ''}`);
console.log(`[tenant] CSV directory: ${CSV_DIR}`);
console.log(`[tenant] Tables to import (in order): ${TABLES_IN_ORDER.join(', ')}`);
console.log('');

const results = [];

try {
  for (const tableName of TABLES_IN_ORDER) {
    const csvPath = findCsvForTable(tableName);
    if (!csvPath) {
      console.error(`[${tableName}] No CSV file found matching pattern ${tableName}-export-*.csv`);
      console.error(`[${tableName}] Aborting — fix this before continuing.`);
      process.exit(1);
    }

    console.log(`[${tableName}] === Starting import ===`);
    try {
      const result = await runImport({
        csvPath,
        tableName,
        truncate,
        batchSize: 500,
      });
      results.push({ tableName, ...result, success: true });
      console.log(`[${tableName}] === Done ===\n`);
    } catch (err) {
      console.error(`[${tableName}] FAILED: ${err.message}`);
      console.error(`[${tableName}] Aborting B3 — fix this table before re-running.`);
      results.push({ tableName, success: false, error: err.message });
      process.exit(1);
    }
  }

  console.log('');
  console.log('=== B3 SUMMARY ===');
  for (const r of results) {
    if (r.success) {
      console.log(`  ${r.tableName}: ${r.imported} rows imported`);
    } else {
      console.log(`  ${r.tableName}: FAILED — ${r.error}`);
    }
  }
  console.log('');
  console.log('[tenant] Done.');
} finally {
  await closePgAdmin();
}
