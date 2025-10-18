-- Add email configuration fields to agency_settings table
ALTER TABLE agency_settings 
ADD COLUMN support_email TEXT,
ADD COLUMN feature_request_email TEXT;