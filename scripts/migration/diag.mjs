import './lib/env.js';
import { readCsv } from './lib/csv.js';
import { pgAdmin } from './lib/client.js';
import fs from 'node:fs';
import path from 'node:path';

const dir = process.env.CSV_EXPORT_DIR;
const files = fs.readdirSync(dir).filter(f => f.startsWith('transcripts-export-') && f.endsWith('.csv')).sort();
const file = files[files.length - 1];
console.log('Reading file:', file);

const { rows } = readCsv(path.join(dir, file));

const { rows: cols } = await pgAdmin.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'transcripts'
  ORDER BY ordinal_position
`);
console.log('\ntranscripts columns on new DB:');
for (const c of cols) console.log('  ' + c.column_name + ' (' + c.data_type + ', nullable=' + c.is_nullable + ', default=' + c.column_default + ')');

const nullTextRows = rows.filter(r => r.text === null || r.text === undefined || r.text === '');
console.log('\nTotal rows: ' + rows.length);
console.log('Rows with null/empty text: ' + nullTextRows.length);

const failing = rows.find(r => r.id === '329de06c-f9ca-4393-847a-019c43018ac1');
if (failing) {
  console.log('\nFAILING ROW:');
  console.log(JSON.stringify(failing, null, 2));
}

console.log('\nSAMPLE OF UP TO 3 NULL-TEXT ROWS:');
for (const r of nullTextRows.slice(0, 3)) {
  console.log('---');
  console.log('id:', r.id);
  console.log('speaker:', r.speaker);
  console.log('text:', JSON.stringify(r.text));
  console.log('buttons:', r.buttons);
  console.log('attachments:', r.attachments);
  console.log('metadata sample:', r.metadata ? String(r.metadata).slice(0, 100) : null);
}
process.exit(0);
