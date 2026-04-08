
## Fix: `sync_last_sign_in` trigger failing on login

### Root Cause

The `sync_last_sign_in()` function fires as a trigger on `auth.users` whenever a user signs in. It tries to update `profiles.last_sign_in_at`, but the function is missing `SET search_path TO 'public'`. When executing in the auth schema context, Postgres can't resolve the unqualified `profiles` table reference, causing:

```
ERROR: relation "profiles" does not exist
```

This error occurs on every login attempt.

### Fix

One database migration to recreate the function with the correct search path:

```sql
CREATE OR REPLACE FUNCTION public.sync_last_sign_in()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    UPDATE profiles SET last_sign_in_at = NEW.last_sign_in_at WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
```

This is a single-line addition (`SET search_path TO 'public'`) to the existing function. No other changes needed.
