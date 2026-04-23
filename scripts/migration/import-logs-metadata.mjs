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
  'subscription_plans',
  'platform_branding',
  'email_templates',
  'user_passwords',
  'user_roles',
  'agency_subscriptions',
  'client_subscriptions',
  'analytics_tabs',
  'analytics_cards',
  'email_send_log',
  'agent_update_logs',
  'impersonation_sessions',
  'audit_log',
];

// Populated reactively if specific columns need nulling or FK order issues emerge.
const TABLE_OVERRIDES = {};

function findCsvForTable(tableName, prefix) {
  const effectivePrefix = prefix ?? tableName;
  const files = fs
    .readdirSync(CSV_DIR)
    .filter((f) => f.startsWith(`${effectivePrefix}-export-`) && f.endsWith('.csv'))
    .sort();
  if (files.length === 0) return null;
  if (files.length > 1) {
    console.warn(`[${tableName}] Multiple exports found for prefix '${effectivePrefix}' — using newest: ${files[files.length - 1]}`);
  }
  return path.join(CSV_DIR, files[files.length - 1]);
}

console.log(`[logs] Starting B6 logs and metadata import${truncate ? ' (--truncate)' : ''}`);
console.log(`[logs] CSV directory: ${CSV_DIR}`);
console.log(`[logs] Tables to import (in order): ${TABLES_IN_ORDER.join(', ')}`);
console.log('');

const results = [];

try {
  for (const tableName of TABLES_IN_ORDER) {
    const override = TABLE_OVERRIDES[tableName] ?? {};
    const csvPath = findCsvForTable(tableName, override.csvPrefix);
    if (!csvPath) {
      const searchedFor = override.csvPrefix ?? tableName;
      console.error(`[${tableName}] No CSV file found matching pattern ${searchedFor}-export-*.csv`);
      console.error(`[${tableName}] Aborting B6 — fix this before continuing.`);
      process.exit(1);
    }

    const { csvPrefix, ...runImportOverride } = override;

    console.log(`[${tableName}] === Starting import ===`);
    try {
      const result = await runImport({
        csvPath,
        tableName,
        truncate,
        batchSize: 500,
        ...runImportOverride,
      });
      results.push({ tableName, ...result, success: true });
      console.log(`[${tableName}] === Done ===\n`);
    } catch (err) {
      console.error(`[${tableName}] FAILED: ${err.message}`);
      console.error(`[${tableName}] Aborting B6 — fix this table before re-running.`);
      results.push({ tableName, success: false, error: err.message });
      process.exit(1);
    }
  }

  console.log('');
  console.log('=== B6 SUMMARY ===');
  for (const r of results) {
    if (r.success) {
      console.log(`  ${r.tableName}: ${r.imported} rows imported`);
    } else {
      console.log(`  ${r.tableName}: FAILED — ${r.error}`);
    }
  }
  console.log('');
  console.log('[logs] Done.');
} finally {
  await closePgAdmin();
}
