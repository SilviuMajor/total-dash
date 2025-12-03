-- Modify user_passwords table to store hints instead of full passwords

-- First, add must_change_password flag
ALTER TABLE public.user_passwords 
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Allow NULL values for password_hint (since we're clearing them)
ALTER TABLE public.user_passwords 
  ALTER COLUMN password_text DROP NOT NULL;

-- Rename the column
ALTER TABLE public.user_passwords 
  RENAME COLUMN password_text TO password_hint;

-- Clear all existing plaintext passwords
UPDATE public.user_passwords SET password_hint = NULL;

-- Add comment to clarify the column's purpose
COMMENT ON COLUMN public.user_passwords.password_hint IS 'First 2 characters of password only - NOT the full password';