import { newSupabase, pgAdmin } from './client.js';
import { readCsv } from './csv.js';

export async function importAuthUsers(csvPath, { truncate = false } = {}) {
  const { rows } = readCsv(csvPath);
  console.log(`[auth] Found ${rows.length} users in CSV`);

  if (truncate) {
    console.log('[auth] Truncate flag set — deleting all existing auth users');
    let page = 1;
    while (true) {
      const { data, error } = await newSupabase.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw new Error(`listUsers failed: ${error.message}`);
      if (!data.users.length) break;
      for (const u of data.users) {
        const { error: delErr } = await newSupabase.auth.admin.deleteUser(u.id);
        if (delErr) console.warn(`[auth] Failed to delete ${u.email}: ${delErr.message}`);
        else console.log(`[auth] Deleted ${u.email}`);
      }
      if (data.users.length < 100) break;
      page++;
    }
  }

  const failures = [];

  for (const row of rows) {
    const userMeta = parseJsonOrNull(row.raw_user_meta_data) || {};
    const appMeta = parseJsonOrNull(row.raw_app_meta_data) || {};

    // STRATEGY 1: Admin SDK with password_hash
    const { data, error } = await newSupabase.auth.admin.createUser({
      id: row.id,
      email: row.email,
      password_hash: row.encrypted_password,
      email_confirm: true,
      user_metadata: userMeta,
      app_metadata: appMeta,
      phone: row.phone || undefined,
      phone_confirm: !!row.phone_confirmed_at,
    });

    if (error) {
      console.warn(`[auth] Admin SDK failed for ${row.email}: ${error.message}`);
      console.warn('[auth] Falling back to direct SQL insert');
      const sqlOk = await directSqlInsert(row);
      if (!sqlOk) {
        failures.push({ email: row.email, reason: error.message });
        continue;
      }
      console.log(`[auth] ${row.email}: created via SQL fallback`);
      continue;
    }

    // Verify id persisted correctly
    const persistedId = data.user?.id;
    if (persistedId !== row.id) {
      console.warn(`[auth] ID mismatch for ${row.email}: expected ${row.id}, got ${persistedId}`);
      console.warn('[auth] Deleting and retrying via direct SQL');
      await newSupabase.auth.admin.deleteUser(persistedId);
      const sqlOk = await directSqlInsert(row);
      if (!sqlOk) {
        failures.push({ email: row.email, reason: 'ID mismatch, SQL fallback also failed' });
        continue;
      }
      console.log(`[auth] ${row.email}: created via SQL fallback`);
      continue;
    }

    // Verify password hash persisted correctly
    const hashInDb = await getPasswordHash(row.id);
    if (hashInDb !== row.encrypted_password) {
      console.warn(`[auth] Password hash mismatch for ${row.email}`);
      console.warn(`[auth]   Expected: ${row.encrypted_password.slice(0, 15)}...`);
      console.warn(`[auth]   Got:      ${(hashInDb || 'null').slice(0, 15)}...`);
      console.warn('[auth] Patching hash directly via SQL');
      const patched = await patchPasswordHash(row.id, row.encrypted_password);
      if (!patched) {
        failures.push({ email: row.email, reason: 'Hash mismatch, patch failed' });
        continue;
      }
      console.log(`[auth] ${row.email}: created via admin SDK + SQL hash patch`);
      continue;
    }

    console.log(`[auth] ${row.email}: created via admin SDK`);
  }

  console.log(`\n[auth] Summary: ${rows.length - failures.length} / ${rows.length} succeeded`);
  if (failures.length) {
    console.error('[auth] Failures:');
    for (const f of failures) console.error(`  - ${f.email}: ${f.reason}`);
    process.exit(1);
  }

  const count = await countAuthUsers();
  console.log(`[auth] auth.users row count: ${count}`);
  if (count !== rows.length) {
    console.error(`[auth] Count mismatch — expected ${rows.length}, got ${count}`);
    process.exit(1);
  }
}

function parseJsonOrNull(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return null; }
}

async function directSqlInsert(row) {
  const sql = `
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, phone, phone_confirmed_at, is_sso_user
    ) VALUES (
      $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11
    )
    ON CONFLICT (id) DO NOTHING;
  `;
  try {
    await pgAdmin.query(sql, [
      row.id,
      row.email,
      row.encrypted_password,
      row.email_confirmed_at || null,
      JSON.stringify(parseJsonOrNull(row.raw_app_meta_data) || {}),
      JSON.stringify(parseJsonOrNull(row.raw_user_meta_data) || {}),
      row.created_at || new Date().toISOString(),
      row.updated_at || new Date().toISOString(),
      row.phone || null,
      row.phone_confirmed_at || null,
      row.is_sso_user === 'true' || row.is_sso_user === true,
    ]);
    return true;
  } catch (err) {
    console.error(`[auth] SQL insert failed for ${row.email}: ${err.message}`);
    return false;
  }
}

async function getPasswordHash(userId) {
  const result = await pgAdmin.query(
    'SELECT encrypted_password FROM auth.users WHERE id = $1',
    [userId]
  );
  return result.rows[0]?.encrypted_password || null;
}

async function patchPasswordHash(userId, hash) {
  try {
    await pgAdmin.query(
      'UPDATE auth.users SET encrypted_password = $1 WHERE id = $2',
      [hash, userId]
    );
    return true;
  } catch (err) {
    console.error(`[auth] patchPasswordHash failed: ${err.message}`);
    return false;
  }
}

async function countAuthUsers() {
  const result = await pgAdmin.query('SELECT COUNT(*)::int AS n FROM auth.users');
  return result.rows[0].n;
}
