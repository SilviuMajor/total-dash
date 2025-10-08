import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, MessageCircle, Send, Instagram, Facebook, Phone, MessageSquare, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { format } from "date-fns";

const domainIcons: Record<string, any> = {
  website: Globe,
  whatsapp: MessageCircle,
  telegram: Send,
  instagram: Instagram,
  messenger: Facebook,
  telephony: Phone,
  sms: MessageSquare,
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'in_development':
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getStatusLabel = (status: string) => {
  return status === 'in_development' ? 'In Development' : 'Active';
};

export default function AgentSpecs() {
  const { selectedAgentId } = useClientAgentContext();
  const [agent, setAgent] = useState<any>(null);
  const [capacity, setCapacity] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [updateLogs, setUpdateLogs] = useState<any[]>([]);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedAgentId) {
      loadAgentSpecs();
    }
  }, [selectedAgentId]);

  const loadAgentSpecs = async () => {
    try {
      // Load agent details
      const { data: agentData } = await supabase
        .from('agents')
        .select('id, name, status')
        .eq('id', selectedAgentId)
        .single();

      if (agentData) setAgent(agentData);

      // Load spec sections
      const { data: specData } = await supabase
        .from('agent_spec_sections')
        .select('*')
        .eq('agent_id', selectedAgentId);

      if (specData) {
        const capacitySection = specData.find(s => s.section_type === 'capacity');
        const domainsSection = specData.find(s => s.section_type === 'domains');
        
        if (capacitySection && typeof capacitySection.content === 'object' && capacitySection.content !== null) {
          setCapacity((capacitySection.content as any)?.value || "");
        }
        if (domainsSection && typeof domainsSection.content === 'object' && domainsSection.content !== null) {
          setDomains((domainsSection.content as any)?.domains || []);
        }
      }

      // Load workflow categories
      const { data: categoryData } = await supabase
        .from('agent_workflow_categories')
        .select('*')
        .eq('agent_id', selectedAgentId)
        .order('sort_order');

      if (categoryData) setCategories(categoryData);

      // Load workflows
      const { data: workflowData } = await supabase
        .from('agent_workflows')
        .select('*')
        .eq('agent_id', selectedAgentId)
        .order('sort_order');

      if (workflowData) setWorkflows(workflowData);

      // Load update logs
      const { data: logsData } = await supabase
        .from('agent_update_logs')
        .select('*')
        .eq('agent_id', selectedAgentId)
        .order('created_at', { ascending: false });

      if (logsData) setUpdateLogs(logsData);
    } catch (error) {
      console.error('Error loading agent specs:', error);
    } finally {
      setLoading(false);
    }
  };

  const displayedLogs = showAllLogs ? updateLogs : updateLogs.slice(0, 2);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-6">
          <p className="text-muted-foreground">No agent selected</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">{agent.name}</h1>
          <Badge className={getStatusColor(agent.status)}>
            <Activity className="w-3 h-3 mr-1" />
            {getStatusLabel(agent.status)}
          </Badge>
        </div>
        <p className="text-muted-foreground">Agent Specifications</p>
      </div>

      {/* Domains */}
      {domains.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Domains</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {domains.map((domain) => {
                const Icon = domainIcons[domain];
                return (
                  <div
                    key={domain}
                    className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50"
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span className="text-sm font-medium capitalize">{domain}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capacity */}
      {capacity && (
        <Card>
          <CardHeader>
            <CardTitle>Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{capacity}</p>
          </CardContent>
        </Card>
      )}

      {/* Key Workflows */}
      {categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Key Workflows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {categories.map((category) => {
              const categoryWorkflows = workflows.filter(w => w.category === category.id);
              if (categoryWorkflows.length === 0) return null;

              return (
                <div key={category.id}>
                  <h3 className="font-semibold mb-3">{category.name}</h3>
                  <div className="space-y-3">
                    {categoryWorkflows.map((workflow) => (
                      <div key={workflow.id} className="border-l-2 border-primary pl-4">
                        <p className="font-medium">{workflow.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">{workflow.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Update History */}
      {updateLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Update History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {displayedLogs.map((log, index) => (
              <div
                key={log.id}
                className={`p-4 rounded-lg border ${
                  index === 1 && !showAllLogs ? 'opacity-50' : ''
                }`}
              >
                <p className="text-sm">{log.description}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {format(new Date(log.created_at), "MMMM d, yyyy")}
                </p>
              </div>
            ))}
            {updateLogs.length > 2 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowAllLogs(!showAllLogs)}
              >
                {showAllLogs ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-2" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Show All Updates ({updateLogs.length})
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}