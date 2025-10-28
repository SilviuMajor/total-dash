-- Add first_name and last_name to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Auto-split existing full_name data in profiles
UPDATE profiles 
SET 
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE 
    WHEN ARRAY_LENGTH(STRING_TO_ARRAY(full_name, ' '), 1) > 1 
    THEN SUBSTRING(full_name FROM LENGTH(SPLIT_PART(full_name, ' ', 1)) + 2)
    ELSE ''
  END
WHERE full_name IS NOT NULL AND (first_name IS NULL OR last_name IS NULL);

-- Create function to auto-generate full_name from first_name + last_name
CREATE OR REPLACE FUNCTION public.update_full_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.full_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  RETURN NEW;
END;
$$;

-- Create trigger for profiles table
DROP TRIGGER IF EXISTS profiles_update_full_name ON profiles;
CREATE TRIGGER profiles_update_full_name
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_full_name();

-- Add first_name and last_name to client_users table
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Auto-split existing full_name data in client_users
UPDATE client_users 
SET 
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE 
    WHEN ARRAY_LENGTH(STRING_TO_ARRAY(full_name, ' '), 1) > 1 
    THEN SUBSTRING(full_name FROM LENGTH(SPLIT_PART(full_name, ' ', 1)) + 2)
    ELSE ''
  END
WHERE full_name IS NOT NULL AND (first_name IS NULL OR last_name IS NULL);

-- Create function to auto-generate full_name for client_users
CREATE OR REPLACE FUNCTION public.update_client_user_full_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.full_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  RETURN NEW;
END;
$$;

-- Create trigger for client_users table
DROP TRIGGER IF EXISTS client_users_update_full_name ON client_users;
CREATE TRIGGER client_users_update_full_name
BEFORE INSERT OR UPDATE ON client_users
FOR EACH ROW
EXECUTE FUNCTION public.update_client_user_full_name();

-- Add color column to departments table
ALTER TABLE departments ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';

-- Set default colors for existing departments
WITH numbered_depts AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM departments
  WHERE color = '#3b82f6' OR color IS NULL
)
UPDATE departments d
SET color = CASE 
  WHEN nd.rn % 5 = 1 THEN '#3b82f6'
  WHEN nd.rn % 5 = 2 THEN '#10b981'
  WHEN nd.rn % 5 = 3 THEN '#f59e0b'
  WHEN nd.rn % 5 = 4 THEN '#ef4444'
  ELSE '#6366f1'
END
FROM numbered_depts nd
WHERE d.id = nd.id;