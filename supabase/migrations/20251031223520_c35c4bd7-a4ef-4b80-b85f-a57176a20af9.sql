-- Add theme_preference column to profiles table
ALTER TABLE profiles 
ADD COLUMN theme_preference TEXT DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark', 'system'));

-- Update existing users to default light mode
UPDATE profiles SET theme_preference = 'light' WHERE theme_preference IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN profiles.theme_preference IS 'User theme preference: light, dark, or system. Defaults to light.';