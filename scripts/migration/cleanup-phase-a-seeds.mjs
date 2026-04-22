import './lib/env.js';
import { pgAdmin, closePgAdmin } from './lib/client.js';

const ORPHAN_AGENCY_SETTINGS_ID = 'd9f6ae05-ad24-4d21-84a5-05f481bd13c0';

try {
  const { rows: before } = await pgAdmin.query(
    'SELECT id, agency_id FROM public.agency_settings WHERE id = $1',
    [ORPHAN_AGENCY_SETTINGS_ID]
  );

  if (before.length === 0) {
    console.log(`[cleanup] Row ${ORPHAN_AGENCY_SETTINGS_ID} not found — already cleaned, nothing to do.`);
    process.exit(0);
  }

  if (before[0].agency_id !== null) {
    console.error(`[cleanup] ABORT: row ${ORPHAN_AGENCY_SETTINGS_ID} has agency_id=${before[0].agency_id}, not null. Refusing to delete.`);
    process.exit(1);
  }

  const { rowCount } = await pgAdmin.query(
    'DELETE FROM public.agency_settings WHERE id = $1 AND agency_id IS NULL',
    [ORPHAN_AGENCY_SETTINGS_ID]
  );

  console.log(`[cleanup] Deleted ${rowCount} orphan row from agency_settings.`);

  const { rows: after } = await pgAdmin.query('SELECT COUNT(*)::int AS n FROM public.agency_settings');
  console.log(`[cleanup] agency_settings row count after cleanup: ${after[0].n}`);
} finally {
  await closePgAdmin();
}
