-- Drop legacy is_admin()-based policy on text_transcripts.
--
-- The policy "Admins can manage text transcripts" used is_admin(auth.uid()),
-- which keys off the legacy profiles.role = 'admin' flag and grants ALL access
-- to every text_transcripts row across every agency — bypassing the multi-tenant
-- isolation enforced by the other two policies on this table.
--
-- The two remaining policies already cover legitimate access:
--   - "Super admins can manage" via is_super_admin(auth.uid()) is implicit in
--     both the SELECT and the agency-scoped policies below.
--   - "Agency users can manage text transcripts for their agents" scopes by
--     agency_users membership.
--   - "Client users can view text transcripts for their agents" handles read
--     access for client-side users.
--
-- CLAUDE.md rule #4: new policies must use is_super_admin(), not is_admin().

DROP POLICY IF EXISTS "Admins can manage text transcripts" ON public.text_transcripts;
