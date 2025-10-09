import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, MessageCircle, Send, Instagram, Facebook, Phone, MessageSquare, Activity, ChevronDown, ChevronUp, Database, Ticket, Hash, Mail, Calendar, FileText, Folder, Settings as SettingsIcon, Users, Building, Package, ShoppingCart, CreditCard, BarChart, Zap, Cloud, Lock, Key } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const domainIcons: Record<string, any> = {
  website: Globe,
  whatsapp: MessageCircle,
  telegram: Send,
  instagram: Instagram,
  messenger: Facebook,
  telephony: Phone,
  sms: MessageSquare,
};

const integrationIconMap: Record<string, any> = {
  Database, Ticket, MessageSquare, Hash, Mail, Calendar, FileText, Folder, 
  Settings: SettingsIcon, Globe, Phone, Users, Building, Package, ShoppingCart, 
  CreditCard, BarChart, Zap, Cloud, Lock, Key
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
  const [integrations, setIntegrations] = useState<any[]>([]);
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

      // Load integrations
      const { data: integrationsData } = await supabase
        .from('agent_integrations')
        .select(`
          integration_id,
          integration_options (
            id,
            name,
            icon,
            is_custom
          )
        `)
        .eq('agent_id', selectedAgentId)
        .order('sort_order');

      if (integrationsData) {
        const integrationsList = integrationsData.map((item: any) => item.integration_options).filter(Boolean);
        setIntegrations(integrationsList);
      }
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {domains.map((domain) => {
                const Icon = domainIcons[domain];
                const domainColors: Record<string, string> = {
                  website: "from-blue-500/20 to-cyan-500/20",
                  whatsapp: "from-green-500/20 to-emerald-500/20",
                  telegram: "from-sky-500/20 to-blue-500/20",
                  instagram: "from-pink-500/20 to-purple-500/20",
                  messenger: "from-blue-600/20 to-indigo-600/20",
                  telephony: "from-violet-500/20 to-purple-500/20",
                  sms: "from-orange-500/20 to-amber-500/20",
                };
                const color = domainColors[domain] || "from-gray-500/20 to-slate-500/20";
                
                return (
                  <div
                    key={domain}
                    className={cn(
                      "relative flex items-center gap-3 p-3 rounded-lg border-2 bg-gradient-to-br",
                      color,
                      "border-border/50"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center flex-shrink-0">
                      {Icon && <Icon className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <span className="text-sm font-medium capitalize text-foreground">{domain}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integrations */}
      {integrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {integrations.map((integration: any, index) => {
                const Icon = integrationIconMap[integration.icon] || Database;
                const gradients = [
                  "from-blue-500/20 to-cyan-500/20",
                  "from-green-500/20 to-emerald-500/20",
                  "from-purple-500/20 to-pink-500/20",
                  "from-orange-500/20 to-red-500/20",
                  "from-indigo-500/20 to-blue-500/20",
                  "from-teal-500/20 to-green-500/20",
                  "from-pink-500/20 to-rose-500/20",
                  "from-yellow-500/20 to-orange-500/20",
                ];
                const gradient = gradients[index % gradients.length];
                
                return (
                  <div
                    key={integration.id}
                    className={cn(
                      "relative flex items-center gap-3 p-3 rounded-lg border-2 bg-gradient-to-br",
                      gradient,
                      "border-border/50"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{integration.name}</span>
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
            <CardTitle>Capacity (per month)</CardTitle>
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

              const colorMap: Record<string, string> = {
                blue: "from-blue-500 to-cyan-500",
                green: "from-green-500 to-emerald-500",
                purple: "from-purple-500 to-pink-500",
                orange: "from-orange-500 to-amber-500",
                red: "from-red-500 to-rose-500",
                indigo: "from-indigo-500 to-violet-500",
                teal: "from-teal-500 to-cyan-500",
                pink: "from-pink-500 to-fuchsia-500",
              };
              const categoryColor = colorMap[(category as any).color || "blue"];

              return (
                <div key={category.id} className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`h-8 w-1.5 rounded-full bg-gradient-to-b ${categoryColor}`} />
                    <h3 className="font-semibold text-lg">{category.name}</h3>
                  </div>
                  <div className="space-y-3 ml-5">
                    {categoryWorkflows.map((workflow) => (
                      <div key={workflow.id} className="pl-4 border-l-2 border-border">
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