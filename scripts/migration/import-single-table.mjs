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

// CLI: node import-single-table.mjs <tableName> [--truncate] [--null-cols=col1,col2]
const args = process.argv.slice(2);
const tableName = args.find((a) => !a.startsWith('--'));
if (!tableName) {
  console.error('Usage: node import-single-table.mjs <tableName> [--truncate] [--null-cols=col1,col2]');
  process.exit(1);
}
const truncate = args.includes('--truncate');
const nullColsArg = args.find((a) => a.startsWith('--null-cols='));
const nullColumns = nullColsArg
  ? nullColsArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean)
  : [];

function findCsv(name) {
  const files = fs.readdirSync(CSV_DIR)
    .filter((f) => f.startsWith(`${name}-export-`) && f.endsWith('.csv'))
    .sort();
  return files.length ? path.join(CSV_DIR, files[files.length - 1]) : null;
}

const csvPath = findCsv(tableName);
if (!csvPath) {
  console.error(`No CSV found for table ${tableName} matching ${tableName}-export-*.csv`);
  process.exit(1);
}

console.log(`[single] Importing ${tableName} from ${csvPath}${truncate ? ' (--truncate)' : ''}${nullColumns.length ? ' null-cols=' + nullColumns.join(',') : ''}`);

try {
  const result = await runImport({
    csvPath,
    tableName,
    truncate,
    batchSize: 500,
    nullColumns,
  });
  console.log(`[single] Done. Imported ${result.imported} rows.`);
} catch (err) {
  console.error(`[single] FAILED: ${err.message}`);
  process.exit(1);
} finally {
  await closePgAdmin();
}
