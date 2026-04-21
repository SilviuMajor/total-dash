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

## Deleting migration scripts after cutover

Once Phase D (stabilisation) is done and old Lovable Cloud is cancelled, delete the entire `scripts/migration/` folder and remove any `.env.migration*` entries from `.gitignore`.
