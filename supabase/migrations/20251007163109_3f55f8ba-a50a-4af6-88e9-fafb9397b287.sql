-- Add new columns to agency_settings
ALTER TABLE agency_settings
ADD COLUMN agency_name text,
ADD COLUMN agency_logo_url text;

-- Create agency-logos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('agency-logos', 'agency-logos', true);

-- RLS policies for agency-logos bucket
CREATE POLICY "Admins can upload agency logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'agency-logos' AND
  is_admin(auth.uid())
);

CREATE POLICY "Anyone can view agency logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'agency-logos');

CREATE POLICY "Admins can delete agency logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'agency-logos' AND
  is_admin(auth.uid())
);