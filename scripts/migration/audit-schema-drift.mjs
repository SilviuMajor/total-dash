import './lib/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { pgAdmin, closePgAdmin } from './lib/client.js';

const CSV_DIR = process.env.CSV_EXPORT_DIR;
if (!CSV_DIR) {
  console.error('CSV_EXPORT_DIR not set');
  process.exit(1);
}

const FILENAME_TO_TABLE_OVERRIDES = {
  text_transcripts: 'transcripts',
};

const SKIP_PREFIXES = new Set([
  'agents_safe', // view, not a table
]);

function extractPrefix(filename) {
  const match = filename.match(/^(.+)-export-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv$/);
  return match ? match[1] : null;
}

function readCsvHeader(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const firstLine = content.split('\n')[0].trim();
  return firstLine.split(';').map((h) => h.trim());
}

async function getTableColumns(tableName) {
  const { rows } = await pgAdmin.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );
  return rows.map((r) => r.column_name);
}

async function tableExists(tableName) {
  const { rows } = await pgAdmin.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return rows.length > 0;
}

try {
  const allFiles = fs.readdirSync(CSV_DIR).filter((f) => f.endsWith('.csv')).sort();

  const tableToFile = new Map();
  for (const file of allFiles) {
    const prefix = extractPrefix(file);
    if (!prefix) continue;
    if (SKIP_PREFIXES.has(prefix)) continue;
    const tableName = FILENAME_TO_TABLE_OVERRIDES[prefix] ?? prefix;
    const existing = tableToFile.get(tableName);
    if (!existing || file > existing) {
      tableToFile.set(tableName, file);
    }
  }

  console.log('Schema drift audit: CSV headers vs. new DB columns');
  console.log('='.repeat(70));

  const issues = [];

  for (const [tableName, file] of [...tableToFile.entries()].sort()) {
    const csvPath = path.join(CSV_DIR, file);

    const exists = await tableExists(tableName);
    if (!exists) {
      console.log(`\n${tableName}: TABLE DOES NOT EXIST in new DB (file: ${file})`);
      issues.push({ table: tableName, kind: 'table_missing' });
      continue;
    }

    const csvCols = new Set(readCsvHeader(csvPath));
    const dbCols = new Set(await getTableColumns(tableName));

    const inCsvNotDb = [...csvCols].filter((c) => !dbCols.has(c));
    const inDbNotCsv = [...dbCols].filter((c) => !csvCols.has(c));

    if (inCsvNotDb.length === 0 && inDbNotCsv.length === 0) {
      console.log(`${tableName}: OK (${csvCols.size} columns match)`);
      continue;
    }

    console.log(`\n${tableName}: DRIFT`);
    if (inCsvNotDb.length > 0) {
      console.log(`  In CSV but not in new DB (will cause insert failure): ${inCsvNotDb.join(', ')}`);
      issues.push({ table: tableName, kind: 'csv_has_extra', columns: inCsvNotDb });
    }
    if (inDbNotCsv.length > 0) {
      console.log(`  In new DB but not in CSV (safe — will default/null): ${inDbNotCsv.join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  if (issues.length === 0) {
    console.log('No drift found. All CSVs align with target tables.');
  } else {
    console.log(`Summary: ${issues.length} table(s) with drift that will break import:\n`);
    const breakingIssues = issues.filter((i) => i.kind === 'csv_has_extra' || i.kind === 'table_missing');
    for (const issue of breakingIssues) {
      if (issue.kind === 'table_missing') {
        console.log(`  ${issue.table}: table doesn't exist`);
      } else {
        console.log(`  ${issue.table}: CSV has extra columns ${issue.columns.join(', ')}`);
      }
    }
    console.log('\nNext step: create a reconciliation migration adding the missing columns,');
    console.log('or decide per-column whether to add to schema or drop from import.');
  }
} finally {
  await closePgAdmin();
}
