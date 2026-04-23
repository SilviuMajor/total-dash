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

## Phase B5 — conversational data

**Prerequisite:** Phase B4 (feature data) must be complete.

```bash
npm run import-conversations
npm run import-conversations -- --truncate
```

Imports 7 conversational-data tables in FK order: canned_responses → conversations → transcripts → handover_sessions → conversation_tags → conversation_read_status → conversation_status_history.

Special case: `transcripts` CSV is named `text_transcripts-export-*.csv` (not `transcripts-export-*.csv`). The entry script's `TABLE_OVERRIDES` handles this via the `csvPrefix` mechanism.

If a table fails, the script aborts. Diagnose the specific failure, apply a fix (nullColumns / reorder / single-table helper), re-run.

## Single-table re-import (recovery)

If a single table needs to be re-imported without running a full phase script (e.g. cascade damage, partial run, targeted retry):

```bash
npm run import-single -- <tableName> [--truncate] [--null-cols=col1,col2]
```

Examples:

```bash
# Re-import client_users fresh, nulling the legacy department_id
npm run import-single -- client_users --truncate --null-cols=department_id

# Append-only import of a logs table
npm run import-single -- audit_log
```

## Deleting migration scripts after cutover

Once Phase D (stabilisation) is done and old Lovable Cloud is cancelled, delete the entire `scripts/migration/` folder and remove any `.env.migration*` entries from `.gitignore`.
