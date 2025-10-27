-- Permanently delete any plans with "trial" or "free" in the name
-- This removes the deleted Free Trial plan from the database completely
DELETE FROM subscription_plans 
WHERE LOWER(name) LIKE '%trial%' 
  OR LOWER(name) LIKE '%free%';