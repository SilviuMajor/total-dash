-- Tighten the fire conditions on the three update_agency_subscription_usage()
-- triggers. Without WHEN clauses these triggers fire on every row update
-- regardless of whether anything counter-relevant changed (e.g. editing a
-- client's contact email re-runs the COUNT(*) for clients).
--
-- The counters depend on:
--   clients      → agency_id and deleted_at (count filters by IS NULL)
--   agents       → agency_id only
--   agency_users → agency_id only
--
-- INSERT and DELETE always need to fire (no NEW or OLD respectively, so a
-- generic WHEN clause can't cover those cleanly — recreate per operation).

DROP TRIGGER IF EXISTS update_client_usage_count ON public.clients;
DROP TRIGGER IF EXISTS update_agent_usage_count ON public.agents;
DROP TRIGGER IF EXISTS update_team_member_usage_count ON public.agency_users;

-- clients
CREATE TRIGGER update_client_usage_count_ins
  AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_agency_subscription_usage();

CREATE TRIGGER update_client_usage_count_del
  AFTER DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_agency_subscription_usage();

CREATE TRIGGER update_client_usage_count_upd
  AFTER UPDATE ON public.clients
  FOR EACH ROW
  WHEN (
    NEW.agency_id IS DISTINCT FROM OLD.agency_id
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
  )
  EXECUTE FUNCTION public.update_agency_subscription_usage();

-- agents
CREATE TRIGGER update_agent_usage_count_ins
  AFTER INSERT ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_agency_subscription_usage();

CREATE TRIGGER update_agent_usage_count_del
  AFTER DELETE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_agency_subscription_usage();

CREATE TRIGGER update_agent_usage_count_upd
  AFTER UPDATE ON public.agents
  FOR EACH ROW
  WHEN (NEW.agency_id IS DISTINCT FROM OLD.agency_id)
  EXECUTE FUNCTION public.update_agency_subscription_usage();

-- agency_users
CREATE TRIGGER update_team_member_usage_count_ins
  AFTER INSERT ON public.agency_users
  FOR EACH ROW EXECUTE FUNCTION public.update_agency_subscription_usage();

CREATE TRIGGER update_team_member_usage_count_del
  AFTER DELETE ON public.agency_users
  FOR EACH ROW EXECUTE FUNCTION public.update_agency_subscription_usage();

CREATE TRIGGER update_team_member_usage_count_upd
  AFTER UPDATE ON public.agency_users
  FOR EACH ROW
  WHEN (NEW.agency_id IS DISTINCT FROM OLD.agency_id)
  EXECUTE FUNCTION public.update_agency_subscription_usage();
