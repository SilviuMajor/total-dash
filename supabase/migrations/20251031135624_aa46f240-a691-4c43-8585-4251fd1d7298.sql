-- Add contact_phone column to agencies table for international phone numbers
ALTER TABLE agencies 
ADD COLUMN contact_phone text;

-- Add comment for documentation
COMMENT ON COLUMN agencies.contact_phone IS 'International phone number with country code (e.g., +1 5551234567)';