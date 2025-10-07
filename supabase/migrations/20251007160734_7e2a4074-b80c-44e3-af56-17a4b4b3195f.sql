-- Drop the old constraint
ALTER TABLE clients 
DROP CONSTRAINT IF EXISTS clients_status_check;

-- Add the updated constraint with 'deleting' included
ALTER TABLE clients 
ADD CONSTRAINT clients_status_check 
CHECK (status = ANY (ARRAY['active'::text, 'testing'::text, 'inactive'::text, 'deleting'::text]));