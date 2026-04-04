import { useEffect, useState } from "react";
import { PageSkeleton } from "@/components/skeletons";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useToast } from "@/hooks/use-toast";
import { Plus, AlertCircle } from "lucide-react";
import { useAgencyAgents } from "@/hooks/queries/useAgencyAgents";

export default function AgencyAgents() {
  const { profile, isPreviewMode, previewAgency } = useMultiTenantAuth();
  const { activeSession } = useImpersonation();
  const agencyId = isPreviewMode 
    ? (previewAgency?.id || activeSession?.agency_id || sessionStorage.getItem('preview_agency')) 
    : profile?.agency?.id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [canAddMore, setCanAddMore] = useState(true);
  const [limits, setLimits] = useState<any>(null);

  const { data: agents = [], isLoading } = useAgencyAgents(agencyId);

  useEffect(() => {
    checkLimits();
  }, [agencyId]);

  const checkLimits = async () => {
    if (!agencyId) return;

    const { data } = await supabase.rpc('check_agency_limit', {
      _agency_id: agencyId,
      _limit_type: 'agents'
    });

    setCanAddMore(data === true);

    const { data: subData } = await supabase
      .from('agency_subscriptions')
      .select(`
        current_agents,
        custom_max_agents,
        is_custom_limits,
        subscription_plans:plan_id (max_agents)
      `)
      .eq('agency_id', agencyId)
      .single();

    setLimits(subData);
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  const maxAgents = limits?.is_custom_limits ? limits.custom_max_agents : limits?.subscription_plans?.max_agents;
  const currentAgents = limits?.current_agents || 0;
  const isOverLimit = maxAgents !== -1 && currentAgents > maxAgents;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Manage your AI agents
            {limits && (
              <span className={`ml-2 ${isOverLimit ? 'text-red-500 font-semibold' : ''}`}>
                ({currentAgents} / {maxAgents === -1 ? '∞' : maxAgents})
              </span>
            )}
          </p>
        </div>
        <Button
          disabled={!canAddMore || currentAgents >= maxAgents}
          onClick={() => navigate('/agency/agents/new')}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Agent
        </Button>
      </div>

      {isOverLimit && (
        <Card className="border-red-500 bg-red-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="font-semibold text-red-500">Over Subscription Limit</p>
              <p className="text-sm text-muted-foreground">
                You currently have {currentAgents} agents but your plan allows {maxAgents}.
                You cannot add new agents until you delete some or upgrade your plan.
              </p>
            </div>
            <Button variant="outline" className="ml-auto" onClick={() => navigate('/agency/subscription')}>
              Upgrade
            </Button>
          </CardContent>
        </Card>
      )}

      {!canAddMore && !isOverLimit && (
        <Card className="border-yellow-500 bg-yellow-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="font-semibold">Agent Limit Reached</p>
              <p className="text-sm text-muted-foreground">Upgrade your subscription to add more agents</p>
            </div>
            <Button variant="outline" className="ml-auto" onClick={() => navigate('/agency/subscription')}>
              Upgrade
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2.5 bg-muted/50 border-b border-border">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agent</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-24 text-center">Provider</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-24 text-center">Status</span>
          <span className="w-24" />
        </div>

        {agents.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground font-medium">No agents created yet</p>
            <p className="text-muted-foreground text-sm mt-1">Create your first AI agent to get started.</p>
          </div>
        ) : agents.map((agent: any) => {
          const initials = agent.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
          return (
            <div
              key={agent.id}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors last:border-0"
            >
              {/* Name + avatar */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-primary">{initials}</span>
                </div>
                <p className="text-sm font-medium truncate">{agent.name}</p>
              </div>

              {/* Provider */}
              <div className="w-24 flex justify-center">
                <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium capitalize">{agent.provider}</span>
              </div>

              {/* Status */}
              <div className="w-24 flex justify-center">
                {agent.status === 'active' && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-green-50 text-green-600 font-medium">Active</span>
                )}
                {agent.status === 'testing' && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-yellow-50 text-yellow-600 font-medium">Testing</span>
                )}
                {agent.status === 'in_development' && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">Dev</span>
                )}
              </div>

              {/* Action */}
              <div className="w-24 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => navigate(`/agency/agents/${agent.id}`)}
                >
                  Manage
                </Button>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
