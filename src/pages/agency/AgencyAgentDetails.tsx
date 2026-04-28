import { useParams, useNavigate } from "react-router-dom";
import { PageSkeleton } from "@/components/skeletons";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentDetailHeader } from "@/components/agent-management/AgentDetailHeader";
import { VoiceflowSettings } from "@/components/agent-management/voiceflow/VoiceflowSettings";
import { VoiceflowConversationSettings } from "@/components/agent-management/voiceflow/VoiceflowConversationSettings";
import { VoiceflowHandoverSettings } from "@/components/agent-management/voiceflow/VoiceflowHandoverSettings";
import { VoiceflowKnowledgeBase } from "@/components/agent-management/voiceflow/VoiceflowKnowledgeBase";
import { VoiceflowWidget } from "@/components/agent-management/voiceflow/VoiceflowWidget";
import { VoiceflowChannels } from "@/components/agent-management/voiceflow/VoiceflowChannels";
import { RetellSettings } from "@/components/agent-management/retell/RetellSettings";
import { RetellKnowledgeBase } from "@/components/agent-management/retell/RetellKnowledgeBase";
import { RetellWidget } from "@/components/agent-management/retell/RetellWidget";
import { RetellChannels } from "@/components/agent-management/retell/RetellChannels";
import { SpecsSettings } from "@/components/agent-management/specs/SpecsSettings";
import { WidgetTestPanel } from "@/components/agent-management/voiceflow/widget/WidgetTestPanel";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useToast } from "@/hooks/use-toast";

interface Agent {
  id: string;
  name: string;
  provider: string;
  config: Record<string, any>;
  created_at: string | null;
  status: 'active' | 'testing' | 'in_development';
  agency_id: string | null;
}

interface AssignedClient {
  id: string;
  name: string;
}

export default function AgencyAgentDetails() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { profile, previewAgency } = useMultiTenantAuth();
  const { activeSession } = useImpersonation();
  const agencyId = profile?.agency?.id
    || previewAgency?.id
    || activeSession?.agency_id
    || sessionStorage.getItem('preview_agency')
    || undefined;
  const { toast } = useToast();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [assignedClients, setAssignedClients] = useState<AssignedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("client-access");

  useEffect(() => {
    if (agencyId) {
      loadAgentDetails();
    }
  }, [agentId, agencyId]);

  const loadAgentDetails = async () => {
    if (!agentId || !agencyId) return;

    setLoading(true);
    try {
      // F14 fix: read from agents_safe (CLAUDE.md rule #2) — page only
      // displays ceiling toggles, never API keys. Writes go through the
      // update_agent_config RPC (handleToggleAccess), which preserves keys.
      const { data: agentData, error: agentError } = await supabase
        .from("agents_safe" as any)
        .select("*")
        .eq("id", agentId)
        .eq("agency_id", agencyId)
        .single() as { data: any; error: any };

      if (agentError) {
        toast({
          title: "Access Denied",
          description: "This agent does not belong to your agency",
          variant: "destructive",
        });
        navigate("/agency/agents");
        return;
      }

      setAgent({
        ...agentData,
        config: (agentData.config as Record<string, any>) || {}
      });

      const { data: clientsData, error: clientsError } = await supabase
        .from("agent_assignments")
        .select("client_id, clients(id, name)")
        .eq("agent_id", agentId);

      if (clientsError) throw clientsError;
      
      const clients = clientsData
        .map(item => item.clients)
        .filter(Boolean) as AssignedClient[];
      
      setAssignedClients(clients);
    } catch (error) {
      console.error("Error loading agent details:", error);
      toast({
        title: "Error",
        description: "Failed to load agent details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (!agent) {
    return (
      <div className="p-8">
        <p>Agent not found</p>
      </div>
    );
  }

  const renderProviderContent = (tab: string) => {
    if (agent.provider === "voiceflow") {
      switch (tab) {
        case "widget":
          return <VoiceflowWidget agent={agent} onUpdate={loadAgentDetails} />;
        case "knowledge-base":
          return <VoiceflowKnowledgeBase agent={agent} />;
        case "channels":
          return <VoiceflowChannels agent={agent} />;
        case "conversations":
          return <VoiceflowConversationSettings agent={agent} onUpdate={loadAgentDetails} />;
        case "handover":
          return <VoiceflowHandoverSettings agent={agent} onUpdate={loadAgentDetails} />;
        case "config":
          return <VoiceflowSettings agent={agent} onUpdate={loadAgentDetails} />;
        default:
          return null;
      }
    } else if (agent.provider === "retell") {
      switch (tab) {
        case "widget":
          return <RetellWidget agent={agent} />;
        case "knowledge-base":
          return <RetellKnowledgeBase agent={agent} />;
        case "channels":
          return <RetellChannels agent={agent} />;
        case "config":
          return <RetellSettings agent={agent} onUpdate={loadAgentDetails} />;
        default:
          return null;
      }
    }
    return null;
  };

  const handleToggleAccess = async (key: string, checked: boolean) => {
    await supabase.rpc('update_agent_config', {
      p_agent_id: agent.id,
      p_config_updates: { [key]: checked },
    });
    loadAgentDetails();
  };

  const content = (
    <div className="p-6 space-y-6">
      <AgentDetailHeader 
        agent={agent} 
        assignedClients={assignedClients} 
        onUpdate={loadAgentDetails}
        onBack={() => navigate("/agency/agents")}
        description="Agent Management Dashboard"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="client-access"><Lock className="w-3.5 h-3.5 mr-1.5" />Client Access</TabsTrigger>
          <TabsTrigger value="widget">Widget</TabsTrigger>
          <TabsTrigger value="knowledge-base">Knowledge Base</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="specs">Specs</TabsTrigger>
          {agent.provider === "voiceflow" && <TabsTrigger value="conversations">Conversations</TabsTrigger>}
          {agent.provider === "voiceflow" && <TabsTrigger value="handover">Handover</TabsTrigger>}
          <TabsTrigger value="config">Config</TabsTrigger>
        </TabsList>

        <TabsContent value="client-access" className="space-y-6">
          {/* Agency-only banner */}
          <div className="flex items-center gap-3 p-3 border border-dashed border-primary/40 rounded-lg bg-primary/5">
            <Lock className="w-4 h-4 text-primary shrink-0" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Agency only</span> — These controls determine what your client can see for this agent. Clients do not see this page.
            </p>
          </div>

          {/* Sidebar pages */}
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b">
              <h3 className="text-sm font-semibold">Sidebar pages</h3>
            </div>
            {[
              { key: "client_conversations_enabled", label: "Conversations", desc: "View conversations and handle handovers" },
              { key: "client_transcripts_enabled", label: "Transcripts", desc: "View completed conversation records" },
              { key: "client_analytics_enabled", label: "Analytics", desc: "View performance metrics and insights" },
              { key: "client_specs_enabled", label: "Specifications", desc: "View agent specs and update logs" },
              { key: "client_knowledge_base_enabled", label: "Knowledge base", desc: "View and manage knowledge base content" },
              { key: "client_guides_enabled", label: "Guides", desc: "View agent guides and documentation" },
              { key: "client_agent_settings_enabled", label: "Agent settings", desc: "Access agent configuration pages" },
            ].map((item, i, arr) => (
              <div key={item.key} className={`flex items-center justify-between p-4 ${i < arr.length - 1 ? 'border-b' : ''}`}>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch
                  checked={agent.config?.[item.key] !== false}
                  onCheckedChange={(checked) => handleToggleAccess(item.key, checked)}
                />
              </div>
            ))}
          </div>

          {/* Agent Settings sub-tabs — only show if agent_settings is enabled */}
          {agent.config?.client_agent_settings_enabled !== false && (
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b">
                <h3 className="text-sm font-semibold">Agent settings sub-tabs</h3>
              </div>
              {[
                { key: "client_widget_access_enabled", label: "Widget", desc: "View and edit widget appearance" },
                { key: "client_channels_access_enabled", label: "Channels", desc: "View and manage communication channels" },
                ...(agent.provider === "voiceflow" ? [
                  { key: "client_conversations_settings_enabled", label: "Conversation settings", desc: "Configure auto-end timers and thresholds" },
                  { key: "client_handover_settings_enabled", label: "Handover settings", desc: "Configure inactivity nudge and timeout" },
                ] : []),
              ].map((item, i, arr) => (
                <div key={item.key} className={`flex items-center justify-between p-4 ${i < arr.length - 1 ? 'border-b' : ''}`}>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={agent.config?.[item.key] !== false}
                    onCheckedChange={(checked) => handleToggleAccess(item.key, checked)}
                  />
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">Changes save automatically. Disabling a page removes it from all client users immediately.</p>
        </TabsContent>

        <TabsContent value="widget" className="space-y-6">
          {renderProviderContent("widget")}
        </TabsContent>

        <TabsContent value="knowledge-base" className="space-y-6">
          {renderProviderContent("knowledge-base")}
        </TabsContent>

        <TabsContent value="channels" className="space-y-6">
          {renderProviderContent("channels")}
        </TabsContent>

        <TabsContent value="specs" className="space-y-6">
          <SpecsSettings agent={agent} />
        </TabsContent>

        {agent.provider === "voiceflow" && (
          <TabsContent value="conversations" className="space-y-6">
            {renderProviderContent("conversations")}
          </TabsContent>
        )}

        {agent.provider === "voiceflow" && (
          <TabsContent value="handover" className="space-y-6">
            {renderProviderContent("handover")}
          </TabsContent>
        )}

        <TabsContent value="config" className="space-y-6">
          {renderProviderContent("config")}
        </TabsContent>
      </Tabs>
    </div>
  );

  return agent.provider === 'voiceflow' ? (
    <WidgetTestPanel agent={agent}>
      {content}
    </WidgetTestPanel>
  ) : content;
}