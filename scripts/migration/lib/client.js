import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { requireEnv } from './env.js';

const url = requireEnv('NEW_SUPABASE_URL');
const serviceKey = requireEnv('NEW_SUPABASE_SERVICE_ROLE_KEY');

export const newSupabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let _pgClient = null;

export async function getPgAdmin() {
  if (_pgClient) return _pgClient;
  const password = requireEnv('NEW_SUPABASE_DB_PASSWORD');
  const client = new pg.Client({
    host: 'aws-1-eu-west-2.pooler.supabase.com',
    port: 5432,
    user: 'postgres.nznfznjlroycddegwvpt',
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  _pgClient = client;
  return client;
}

export async function closePgAdmin() {
  if (_pgClient) {
    await _pgClient.end();
    _pgClient = null;
  }
}

// Lazy proxy: `pgAdmin.query(...)` auto-connects on first use.
export const pgAdmin = {
  async query(...args) {
    const c = await getPgAdmin();
    return c.query(...args);
  },
};
