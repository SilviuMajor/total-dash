-- Create platform_branding table
CREATE TABLE platform_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'FiveLeaf',
  logo_light_url TEXT,
  logo_dark_url TEXT,
  favicon_light_url TEXT,
  favicon_dark_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default row
INSERT INTO platform_branding (company_name) VALUES ('FiveLeaf');

-- RLS Policies for platform_branding
ALTER TABLE platform_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view platform branding"
  ON platform_branding FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage platform branding"
  ON platform_branding FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_platform_branding_updated_at
  BEFORE UPDATE ON platform_branding
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add new branding columns to agencies table
ALTER TABLE agencies 
  ADD COLUMN logo_light_url TEXT,
  ADD COLUMN logo_dark_url TEXT,
  ADD COLUMN favicon_light_url TEXT,
  ADD COLUMN favicon_dark_url TEXT;

-- Migrate existing logo_url to both light and dark
UPDATE agencies 
SET 
  logo_light_url = logo_url,
  logo_dark_url = logo_url
WHERE logo_url IS NOT NULL;

-- Drop old logo_url column
ALTER TABLE agencies DROP COLUMN logo_url;

-- Create platform-branding storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('platform-branding', 'platform-branding', true);

-- RLS Policies for platform-branding bucket
CREATE POLICY "Public can view platform branding files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'platform-branding');

CREATE POLICY "Super admins can upload platform branding files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'platform-branding' 
    AND is_super_admin(auth.uid())
  );

CREATE POLICY "Super admins can update platform branding files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'platform-branding' AND is_super_admin(auth.uid()))
  WITH CHECK (bucket_id = 'platform-branding' AND is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete platform branding files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'platform-branding' AND is_super_admin(auth.uid()));