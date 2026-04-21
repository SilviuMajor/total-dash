import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parse } from 'csv-parse/sync';

export function readCsv(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const records = parse(raw, {
    delimiter: ';',
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  const fileName = basename(filePath);
  const rows = records.map((row) => processRow(row, fileName));

  return { rows, fileName, rowCount: rows.length };
}

function processRow(row, fileName) {
  const out = {};
  for (const [key, rawVal] of Object.entries(row)) {
    if (rawVal === '' || rawVal == null) {
      out[key] = null;
      continue;
    }
    const val = rawVal;
    const first = val[0];
    if (first === '{' || first === '[') {
      try {
        out[key] = JSON.parse(val);
        continue;
      } catch {
        console.warn(`[csv] ${fileName}: row id=${row.id ?? '?'} column="${key}" looks like JSON but failed to parse, leaving as string`);
      }
    }
    out[key] = val;
  }
  return out;
}
