-- Allow client users with settings access to UPDATE/INSERT/DELETE departments
-- for their own client. Previously they had FOR SELECT only, so the
-- "Handover acceptance timeout (seconds)" field appeared to save in the UI
-- but the RLS-blocked UPDATE silently failed and the value reverted.
--
-- Uses the existing coarse has_settings_permission() helper (same gate used
-- by client_users / client_settings / client_roles policies) — the
-- finer-grained settings_departments_manage flag is enforced UI-side via
-- the readOnly prop on DepartmentManagement.

DROP POLICY IF EXISTS "Client users with settings can manage departments" ON public.departments;
CREATE POLICY "Client users with settings can manage departments"
ON public.departments FOR ALL
USING (public.has_settings_permission(auth.uid(), client_id))
WITH CHECK (public.has_settings_permission(auth.uid(), client_id));
