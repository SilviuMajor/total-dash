-- Phase 1: Database Schema Changes

-- 1.1 Update agencies table - Split custom_domain and add whitelabel fields
ALTER TABLE public.agencies 
  DROP COLUMN IF EXISTS custom_domain,
  ADD COLUMN IF NOT EXISTS whitelabel_subdomain TEXT DEFAULT 'dashboard',
  ADD COLUMN IF NOT EXISTS whitelabel_domain TEXT,
  ADD COLUMN IF NOT EXISTS whitelabel_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whitelabel_verified_at TIMESTAMP WITH TIME ZONE;

-- 1.2 Update clients table - Add slug column
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Generate slugs for existing clients from their names
UPDATE public.clients
SET slug = LOWER(REGEXP_REPLACE(
  REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'),
  '\s+', '-', 'g'
))
WHERE slug IS NULL;

-- Handle duplicate slugs by appending agency-specific suffixes
WITH ranked_clients AS (
  SELECT 
    id,
    slug,
    agency_id,
    ROW_NUMBER() OVER (PARTITION BY agency_id, slug ORDER BY created_at) as rn
  FROM public.clients
)
UPDATE public.clients c
SET slug = rc.slug || '-' || rc.rn
FROM ranked_clients rc
WHERE c.id = rc.id AND rc.rn > 1;

-- Make slug NOT NULL and add unique constraint per agency
ALTER TABLE public.clients 
  ALTER COLUMN slug SET NOT NULL,
  ADD CONSTRAINT clients_agency_slug_unique UNIQUE (agency_id, slug);

-- 1.3 Enforce client_users UNIQUE constraint - Remove duplicates first
-- Keep only the oldest association for each user
DELETE FROM public.client_users cu1
WHERE EXISTS (
  SELECT 1 FROM public.client_users cu2
  WHERE cu1.user_id = cu2.user_id
  AND cu1.created_at > cu2.created_at
);

-- Add UNIQUE constraint on user_id
ALTER TABLE public.client_users
  ADD CONSTRAINT client_users_user_id_unique UNIQUE (user_id);

-- Create trigger to prevent future duplicate associations
CREATE OR REPLACE FUNCTION public.prevent_duplicate_client_user()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.client_users 
    WHERE user_id = NEW.user_id 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'User can only belong to one client organization';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_duplicate_client_user_trigger
  BEFORE INSERT OR UPDATE ON public.client_users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_client_user();

-- 1.4 Create auth_contexts table for context tracking
CREATE TABLE IF NOT EXISTS public.auth_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  context_type TEXT NOT NULL CHECK (context_type IN ('super_admin', 'agency', 'client')),
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_preview BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_context CHECK (
    (context_type = 'super_admin' AND agency_id IS NULL AND client_id IS NULL) OR
    (context_type = 'agency' AND agency_id IS NOT NULL AND client_id IS NULL) OR
    (context_type = 'client' AND client_id IS NOT NULL)
  )
);

-- Enable RLS on auth_contexts
ALTER TABLE public.auth_contexts ENABLE ROW LEVEL SECURITY;

-- RLS policies for auth_contexts
CREATE POLICY "Users can view their own auth contexts"
  ON public.auth_contexts
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage all auth contexts"
  ON public.auth_contexts
  FOR ALL
  USING (is_super_admin(auth.uid()));

-- Create function to cleanup expired auth contexts
CREATE OR REPLACE FUNCTION public.cleanup_expired_auth_contexts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.auth_contexts
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_auth_contexts_user_id ON public.auth_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_contexts_token ON public.auth_contexts(token);
CREATE INDEX IF NOT EXISTS idx_auth_contexts_expires_at ON public.auth_contexts(expires_at);
CREATE INDEX IF NOT EXISTS idx_clients_agency_slug ON public.clients(agency_id, slug);