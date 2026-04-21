import { readCsv } from './csv.js';
import { newSupabase } from './client.js';

export async function importAuthUsers(csvPath, { truncate = false } = {}) {
  const log = (msg) => console.log(`[auth.users] ${msg}`);
  const { rows, rowCount } = readCsv(csvPath);
  log(`read ${rowCount} rows from ${csvPath}`);

  if (truncate) {
    log('truncate=true, listing existing users to delete');
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await newSupabase.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = data?.users ?? [];
      if (users.length === 0) break;
      for (const u of users) {
        const { error: delErr } = await newSupabase.auth.admin.deleteUser(u.id);
        if (delErr) {
          log(`failed to delete ${u.email}: ${delErr.message}`);
          throw delErr;
        }
      }
      log(`deleted page ${page} (${users.length} users)`);
      if (users.length < perPage) break;
      page += 1;
    }
  }

  let created = 0;
  for (const row of rows) {
    const { id, email, password_hash, raw_user_meta_data } = row;
    const userMeta = raw_user_meta_data && typeof raw_user_meta_data === 'object' ? raw_user_meta_data : {};
    const { error } = await newSupabase.auth.admin.createUser({
      id,
      email,
      password_hash,
      user_metadata: userMeta,
      email_confirm: true,
    });
    if (error) {
      log(`createUser failed for ${email}: ${error.message}`);
      throw error;
    }
    created += 1;
    if (created % 50 === 0) log(`created ${created}/${rowCount}`);
  }
  log(`created ${created}/${rowCount} auth users`);
}
