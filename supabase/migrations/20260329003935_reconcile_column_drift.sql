-- Reconcile column drift between committed migrations and live Lovable Cloud schema.
-- These 30 columns exist on the live project (per schema dump taken 20 April 2026)
-- but were never created by any committed migration. They were added out-of-band
-- via Lovable's dashboard SQL editor.
--
-- All statements use ADD COLUMN IF NOT EXISTS so this migration is idempotent
-- and safe to re-run.
--
-- Placed between the missing-tables stub (20260329003930) and the migration
-- that expects these columns to exist (20260329003945 — builds agents_safe view).

-- ============================================================================
-- agents
-- ============================================================================

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS data_region text;

-- ============================================================================
-- client_settings
-- ============================================================================

ALTER TABLE public.client_settings
  ADD COLUMN IF NOT EXISTS admin_capabilities jsonb
    DEFAULT '{"can_create_users": false, "can_edit_permissions": false, "can_create_admin_roles": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS hidden_permissions jsonb
    DEFAULT '[]'::jsonb;

-- ============================================================================
-- client_user_agent_permissions
-- ============================================================================

ALTER TABLE public.client_user_agent_permissions
  ADD COLUMN IF NOT EXISTS role_id uuid,
  ADD COLUMN IF NOT EXISTS has_overrides boolean DEFAULT false;

-- ============================================================================
-- client_users
-- ============================================================================

ALTER TABLE public.client_users
  ADD COLUMN IF NOT EXISTS role_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'::text;

-- ============================================================================
-- conversations
-- ============================================================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS voiceflow_user_id text,
  ADD COLUMN IF NOT EXISTS last_customer_message_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS first_unanswered_message_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS needs_review_reason text,
  ADD COLUMN IF NOT EXISTS customer_base_id text,
  ADD COLUMN IF NOT EXISTS resolution_reason text,
  ADD COLUMN IF NOT EXISTS resolution_note text;

-- ============================================================================
-- departments
-- ============================================================================

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS timeout_seconds integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fallback_to_global boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS fallback_out_of_hours boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC'::text,
  ADD COLUMN IF NOT EXISTS opening_hours_type text DEFAULT 'simple'::text,
  ADD COLUMN IF NOT EXISTS opening_hours jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS always_open boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- ============================================================================
-- profiles
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamp with time zone;

-- ============================================================================
-- transcripts
-- ============================================================================

ALTER TABLE public.transcripts
  ADD COLUMN IF NOT EXISTS attachments jsonb;
