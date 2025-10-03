import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Bot, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Agent {
  id: string;
  name: string;
  provider: string;
}

export function ClientAgentAssignments({ clientId }: { clientId: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assignedAgentIds, setAssignedAgentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    try {
      const [agentsResult, assignmentsResult] = await Promise.all([
        supabase.from('agents').select('*').order('name'),
        supabase.from('agent_assignments').select('agent_id').eq('client_id', clientId),
      ]);

      if (agentsResult.error) throw agentsResult.error;
      if (assignmentsResult.error) throw assignmentsResult.error;

      setAgents(agentsResult.data || []);
      setAssignedAgentIds(new Set(assignmentsResult.data?.map(a => a.agent_id) || []));
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

  const handleToggleAgent = (agentId: string) => {
    const newAssigned = new Set(assignedAgentIds);
    if (newAssigned.has(agentId)) {
      newAssigned.delete(agentId);
    } else {
      newAssigned.add(agentId);
    }
    setAssignedAgentIds(newAssigned);
  };

  const handleSaveAssignments = async () => {
    setSaving(true);
    try {
      // Delete existing assignments
      await supabase
        .from('agent_assignments')
        .delete()
        .eq('client_id', clientId);

      // Insert new assignments with sort_order
      if (assignedAgentIds.size > 0) {
        const assignments = Array.from(assignedAgentIds).map((agentId, index) => ({
          client_id: clientId,
          agent_id: agentId,
          sort_order: index, // Set order based on current list order
        }));

        const { error } = await supabase
          .from('agent_assignments')
          .insert(assignments);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Agent assignments saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Assign Agents</h3>
            <p className="text-sm text-muted-foreground">
              Select which agents this client can access
            </p>
          </div>
          <Button
            onClick={handleSaveAssignments}
            disabled={saving}
            className="bg-foreground text-background hover:bg-foreground/90 gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No agents available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleToggleAgent(agent.id)}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={assignedAgentIds.has(agent.id)}
                    onCheckedChange={() => handleToggleAgent(agent.id)}
                  />
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{agent.name}</p>
                    <p className="text-sm text-muted-foreground">{agent.provider}</p>
                  </div>
                </div>
                <Badge variant={assignedAgentIds.has(agent.id) ? "default" : "outline"}>
                  {assignedAgentIds.has(agent.id) ? "Assigned" : "Not Assigned"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
