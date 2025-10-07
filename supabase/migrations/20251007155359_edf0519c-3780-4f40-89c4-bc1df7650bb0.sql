-- Add deletion tracking fields to clients table
ALTER TABLE clients 
ADD COLUMN deleted_at timestamp with time zone,
ADD COLUMN scheduled_deletion_date timestamp with time zone,
ADD COLUMN deleted_by uuid REFERENCES auth.users(id);

-- Create client-logos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-logos', 'client-logos', true);

-- RLS policies for client-logos bucket
CREATE POLICY "Admins can upload client logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-logos' 
  AND is_admin(auth.uid())
);

CREATE POLICY "Admins can update client logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'client-logos' AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete client logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'client-logos' AND is_admin(auth.uid()));

CREATE POLICY "Anyone authenticated can view client logos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'client-logos');