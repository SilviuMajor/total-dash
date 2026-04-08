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