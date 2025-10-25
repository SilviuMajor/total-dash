import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, AlertCircle } from "lucide-react";

export default function AgencyAgents() {
  const { profile, isPreviewMode, previewAgency } = useMultiTenantAuth();
  const agencyId = isPreviewMode ? previewAgency?.id : profile?.agency?.id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canAddMore, setCanAddMore] = useState(true);
  const [limits, setLimits] = useState<any>(null);

  useEffect(() => {
    loadAgents();
    checkLimits();
  }, [profile]);

  const checkLimits = async () => {
    if (!agencyId) return;

    const { data, error } = await supabase.rpc('check_agency_limit', {
      _agency_id: agencyId,
      _limit_type: 'agents'
    });

    setCanAddMore(data === true);

    const { data: subData } = await supabase
      .from('agency_subscriptions')
      .select(`
        current_agents,
        subscription_plans:plan_id (max_agents)
      `)
      .eq('agency_id', agencyId)
      .single();

    setLimits(subData);
  };

  const loadAgents = async () => {
    if (!agencyId) return;

    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('agency_id', agencyId)
        .order('name');

      if (error) throw error;
      setAgents(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">Agents</h1>
          <p className="text-muted-foreground">
            Manage your AI agents
            {limits && (
              <span className="ml-2">
                ({limits.current_agents} / {limits.subscription_plans?.max_agents === -1 ? '∞' : limits.subscription_plans?.max_agents})
              </span>
            )}
          </p>
        </div>
        <Button
          disabled={!canAddMore}
          onClick={() => navigate('/agency/agents/new')}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Agent
        </Button>
      </div>

      {!canAddMore && (
        <Card className="border-yellow-500 bg-yellow-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="font-semibold">Agent Limit Reached</p>
              <p className="text-sm text-muted-foreground">
                Upgrade your subscription to add more agents
              </p>
            </div>
            <Button
              variant="outline"
              className="ml-auto"
              onClick={() => navigate('/agency/subscription')}
            >
              Upgrade
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{agent.name}</CardTitle>
                  <Badge className="mt-2">{agent.provider}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/agency/agents/${agent.id}`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Manage
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
