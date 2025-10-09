-- Add is_widget_test column to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS is_widget_test BOOLEAN DEFAULT false;

-- Create widget-assets storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('widget-assets', 'widget-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can upload widget assets" ON storage.objects;
DROP POLICY IF EXISTS "Public can view widget assets" ON storage.objects;

-- Add RLS policy for admins to upload widget assets
CREATE POLICY "Admins can upload widget assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'widget-assets' 
  AND is_admin(auth.uid())
);

-- Add RLS policy for public read access to widget assets
CREATE POLICY "Public can view widget assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'widget-assets');