-- Fix infinite recursion in agency_users RLS policies
-- Drop the problematic policy that creates circular dependency
DROP POLICY IF EXISTS "Agency users can view team members" ON public.agency_users;

-- The remaining policies are sufficient:
-- 1. "Users can view their own agency associations" (user_id = auth.uid())
-- 2. "Agency owners can manage team members" (is_agency_owner function)
-- 3. "Super admins can manage all agency users" (is_super_admin function)

-- These policies provide proper access control without circular dependencies