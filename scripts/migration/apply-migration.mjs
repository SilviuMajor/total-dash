import './lib/env.js';
import fs from 'node:fs';
import { pgAdmin, closePgAdmin } from './lib/client.js';

const migrationPath = process.argv[2];
if (!migrationPath) {
  console.error('Usage: node apply-migration.mjs <path-to-migration.sql>');
  process.exit(1);
}

if (!fs.existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');
console.log(`Applying migration from: ${migrationPath}`);
console.log(`SQL preview: ${sql.slice(0, 300)}${sql.length > 300 ? '...' : ''}`);

try {
  await pgAdmin.query(sql);
  console.log('Migration applied successfully.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await closePgAdmin();
}
