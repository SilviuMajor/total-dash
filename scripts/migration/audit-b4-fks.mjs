import './lib/env.js';
import fs from 'node:fs';
import path from 'node:path';

const CSV_DIR = process.env.CSV_EXPORT_DIR;
if (!CSV_DIR) {
  console.error('CSV_EXPORT_DIR not set');
  process.exit(1);
}

const TABLES = [
  'agent_types', 'departments', 'client_roles', 'agents',
  'agent_workflow_categories', 'agent_workflows', 'agent_spec_sections',
  'agent_integrations', 'agent_assignments', 'role_permission_templates',
  'auth_contexts', 'client_user_departments', 'client_user_permissions',
  'client_user_agent_permissions',
];

function findCsv(tableName) {
  const files = fs.readdirSync(CSV_DIR)
    .filter((f) => f.startsWith(`${tableName}-export-`) && f.endsWith('.csv'))
    .sort();
  return files.length ? path.join(CSV_DIR, files[files.length - 1]) : null;
}

function readHeader(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const firstLine = content.split('\n')[0].trim();
  return firstLine.split(';').map((h) => h.trim());
}

console.log('B4 FK audit — columns ending in _id or commonly used as FK');
console.log('='.repeat(70));

for (const table of TABLES) {
  const csv = findCsv(table);
  if (!csv) {
    console.log(`${table}: NO CSV FOUND`);
    continue;
  }
  const cols = readHeader(csv);
  const fkCols = cols.filter((c) =>
    c.endsWith('_id') ||
    c === 'id' ||
    c === 'created_by' ||
    c === 'updated_by'
  );
  console.log(`\n${table}:`);
  console.log(`  all columns (${cols.length}): ${cols.join(', ')}`);
  console.log(`  FK-shaped:    ${fkCols.join(', ') || '(none)'}`);
}

console.log('\n' + '='.repeat(70));
console.log('Review each FK column vs. the current import order.');
console.log('If a table references another B4 table, that other table must come first in TABLES_IN_ORDER.');
