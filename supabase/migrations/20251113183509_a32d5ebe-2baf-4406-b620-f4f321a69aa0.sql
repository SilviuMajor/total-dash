-- Allow super admins to view all profiles
CREATE POLICY "Super admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_super_admin(auth.uid()));