-- Add status field to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS status text 
DEFAULT 'active' 
CHECK (status IN ('active', 'testing', 'inactive'));

-- Update existing clients to have active status
UPDATE clients SET status = 'active' WHERE status IS NULL;