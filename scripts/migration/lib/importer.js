import { readCsv } from './csv.js';
import { newSupabase, getPgAdmin } from './client.js';

export async function runImport({ csvPath, tableName, truncate = false, batchSize = 500, nullColumns = [] }) {
  const log = (msg) => console.log(`[${tableName}] ${msg}`);
  const { rows, rowCount } = readCsv(csvPath);
  log(`read ${rowCount} rows from ${csvPath}`);

  if (nullColumns.length > 0) {
    for (const row of rows) {
      for (const col of nullColumns) {
        row[col] = null;
      }
    }
    log(`forced null for columns: ${nullColumns.join(', ')}`);
  }

  const pg = await getPgAdmin();

  if (truncate) {
    const { rows: existing } = await pg.query(`SELECT COUNT(*)::int AS n FROM public.${tableName};`);
    if (existing[0].n === 0) {
      log(`already empty — skipping wipe`);
    } else {
      log(`deleting ${existing[0].n} row(s) (FK-safe)...`);
      await pg.query(`DELETE FROM public.${tableName};`);
    }
  }

  log(`disabling user triggers`);
  await pg.query(`ALTER TABLE public.${tableName} DISABLE TRIGGER USER;`);

  let insertedCount = 0;
  try {
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error, count } = await newSupabase
        .from(tableName)
        .insert(batch, { count: 'exact' });
      if (error) {
        const badId = batch[0]?.id ?? '?';
        log(`INSERT FAILED at batch starting id=${badId}: ${error.message}`);
        throw error;
      }
      insertedCount += count ?? batch.length;
      log(`inserted ${insertedCount}/${rowCount}`);
    }
  } finally {
    log(`re-enabling user triggers`);
    await pg.query(`ALTER TABLE public.${tableName} ENABLE TRIGGER USER;`);
  }

  log(`imported ${insertedCount} / expected ${rowCount}`);
  if (insertedCount !== rowCount) {
    throw new Error(`[${tableName}] insert count mismatch: inserted ${insertedCount}, expected ${rowCount}`);
  }

  const { rows: countRows } = await pg.query(`SELECT COUNT(*)::int AS c FROM public.${tableName};`);
  log(`total rows in table after import: ${countRows[0].c}`);

  return { imported: insertedCount, expected: rowCount };
}
