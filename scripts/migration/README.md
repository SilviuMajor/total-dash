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

## Phase B2 — auth users (next)

Spec coming after auth.users export is dumped from old project.

## Deleting migration scripts after cutover

Once Phase D (stabilisation) is done and old Lovable Cloud is cancelled, delete the entire `scripts/migration/` folder and remove any `.env.migration*` entries from `.gitignore`.
