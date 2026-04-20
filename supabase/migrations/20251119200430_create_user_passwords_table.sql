-- Create the user_passwords table as it existed in November 2025.
-- This table exists on the old Lovable Cloud project but was never committed as a migration.
-- The original table used `password_text TEXT NOT NULL`.
-- A later migration (20251203225249) adds `must_change_password`, drops the NOT NULL on
-- `password_text`, and renames it to `password_hint`. That later migration needs the
-- pre-rename shape here to work correctly.

CREATE TABLE IF NOT EXISTS public.user_passwords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  password_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_passwords_user_id_key UNIQUE (user_id),
  CONSTRAINT user_passwords_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS. A policy is created in migration 20251119200436.
ALTER TABLE public.user_passwords ENABLE ROW LEVEL SECURITY;
