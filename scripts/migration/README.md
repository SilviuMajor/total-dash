# TotalDash Migration Scripts

One-off scripts for migrating from old Lovable Cloud Supabase to the new standalone project.

## Setup (do this once)

1. `cd scripts/migration`
2. `cp .env.migration.example .env.migration`
3. Fill in `NEW_SUPABASE_SERVICE_ROLE_KEY` and `NEW_SUPABASE_DB_PASSWORD`
4. `npm install`

## Phase B1 — setup tasks

```bash
npm run cleanup-duplicates  # removes duplicate CSV exports
npm run create-buckets       # creates avatars + widget-attachments buckets
```

## Phase B2 — auth users

**Prerequisite:** `auth_users-export-*.csv` must be in `CSV_EXPORT_DIR`.

```bash
npm run import-auth                 # append mode (fails on conflicts)
npm run import-auth -- --truncate   # wipes existing auth users first
```

Expected output (first run): 7 users created via admin SDK, row count matches.

If you see "Falling back to direct SQL insert" or "Hash mismatch" warnings, the import still succeeds — those are known Supabase SDK edge cases (GH issue #1678) handled by the script. Confirm the final summary shows 7/7.

## Phase B3 — tenant hierarchy

**Prerequisite:** Phase B2 (auth users) must be complete. CSVs for all 8 tenant tables must be in `CSV_EXPORT_DIR`.

```bash
npm run import-tenant
npm run import-tenant -- --truncate   # wipes and re-imports (DANGER — cascade-deletes)
```

Imports 8 tables in FK-dependency order: agencies → agency_settings → clients → client_settings → profiles → super_admin_users → agency_users → client_users.

Aborts on first failure so the DB is never left half-populated.

## Phase B4 — feature data

**Prerequisite:** Phase B3 (tenant hierarchy) must be complete.

```bash
npm run import-features
npm run import-features -- --truncate   # wipes and re-imports
```

Imports 15 feature-data tables in FK-dependency order: agent_types → integration_options → departments → client_roles → agents → agent_workflow_categories → agent_workflows → agent_spec_sections → agent_integrations → agent_assignments → role_permission_templates → auth_contexts → client_user_departments → client_user_permissions → client_user_agent_permissions.

Before running imports for the first time, `npm run audit-b4-fks` prints each table's FK-shaped columns so import order can be verified against actual CSV structure.

If a table fails, the script aborts. Diagnose the specific failure (inspect CSV values, check FK targets exist, confirm column names match), apply a fix via `TABLE_OVERRIDES` if the column is legacy/orphan, or add a schema fix if the problem is structural.

## Deleting migration scripts after cutover

Once Phase D (stabilisation) is done and old Lovable Cloud is cancelled, delete the entire `scripts/migration/` folder and remove any `.env.migration*` entries from `.gitignore`.
