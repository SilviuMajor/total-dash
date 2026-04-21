import { readCsv } from './csv.js';
import { newSupabase, getPgAdmin } from './client.js';

export async function runImport({ csvPath, tableName, truncate = false, batchSize = 500 }) {
  const log = (msg) => console.log(`[${tableName}] ${msg}`);
  const { rows, rowCount } = readCsv(csvPath);
  log(`read ${rowCount} rows from ${csvPath}`);

  const pg = await getPgAdmin();

  if (truncate) {
    log(`truncating...`);
    await pg.query(`TRUNCATE TABLE public.${tableName} CASCADE;`);
  }

  log(`disabling user triggers`);
  await pg.query(`ALTER TABLE public.${tableName} DISABLE TRIGGER USER;`);

  let inserted = 0;
  try {
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await newSupabase.from(tableName).insert(batch);
      if (error) {
        const badId = batch[0]?.id ?? '?';
        log(`INSERT FAILED at batch starting id=${badId}: ${error.message}`);
        throw error;
      }
      inserted += batch.length;
      log(`inserted ${inserted}/${rowCount}`);
    }
  } finally {
    log(`re-enabling user triggers`);
    await pg.query(`ALTER TABLE public.${tableName} ENABLE TRIGGER USER;`);
  }

  const { rows: countRows } = await pg.query(`SELECT COUNT(*)::int AS c FROM public.${tableName};`);
  const actual = countRows[0].c;
  log(`imported ${actual} / expected ${rowCount}`);

  if (actual !== rowCount) {
    throw new Error(`[${tableName}] row count mismatch: got ${actual}, expected ${rowCount}`);
  }

  return { imported: actual, expected: rowCount };
}
