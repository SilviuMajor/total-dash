-- Create agency_settings table for global configuration
CREATE TABLE public.agency_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_domain text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy - only admins can manage agency settings
CREATE POLICY "Admins can manage agency settings"
ON public.agency_settings
FOR ALL
USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_agency_settings_updated_at
BEFORE UPDATE ON public.agency_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default agency settings record
INSERT INTO public.agency_settings (agency_domain) VALUES (NULL);

-- Remove custom_domain column from clients table
ALTER TABLE public.clients DROP COLUMN IF EXISTS custom_domain;