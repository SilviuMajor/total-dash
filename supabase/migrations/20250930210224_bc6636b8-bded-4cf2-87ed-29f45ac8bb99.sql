-- Enhance clients table with additional fields
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS contact_phone text,
ADD COLUMN IF NOT EXISTS company_address text,
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS custom_domain text,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Create client_settings table for branding and configuration
CREATE TABLE IF NOT EXISTS public.client_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  logo_url text,
  primary_color text DEFAULT '#000000',
  secondary_color text DEFAULT '#ffffff',
  company_name text,
  custom_css text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(client_id)
);

-- Create client_subscriptions table for billing
CREATE TABLE IF NOT EXISTS public.client_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_name text NOT NULL DEFAULT 'basic',
  monthly_limit integer DEFAULT 1000,
  current_usage integer DEFAULT 0,
  billing_cycle_start timestamp with time zone DEFAULT now(),
  billing_cycle_end timestamp with time zone DEFAULT (now() + interval '1 month'),
  amount_cents integer DEFAULT 0,
  currency text DEFAULT 'USD',
  status text DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(client_id)
);

-- Enhance client_users table with roles
ALTER TABLE public.client_users
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user',
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Enable RLS on new tables
ALTER TABLE public.client_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_settings
CREATE POLICY "Admins can manage client settings"
ON public.client_settings
FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Client users can view their client settings"
ON public.client_settings
FOR SELECT
USING (
  client_id IN (
    SELECT client_id FROM get_user_client_ids(auth.uid())
  )
);

-- RLS Policies for client_subscriptions
CREATE POLICY "Admins can manage client subscriptions"
ON public.client_subscriptions
FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Client users can view their subscription"
ON public.client_subscriptions
FOR SELECT
USING (
  client_id IN (
    SELECT client_id FROM get_user_client_ids(auth.uid())
  )
);

-- Create triggers for updated_at
CREATE TRIGGER update_client_settings_updated_at
BEFORE UPDATE ON public.client_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_subscriptions_updated_at
BEFORE UPDATE ON public.client_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_users_updated_at
BEFORE UPDATE ON public.client_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();