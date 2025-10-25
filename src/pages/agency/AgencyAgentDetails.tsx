import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentDetailHeader } from "@/components/agent-management/AgentDetailHeader";
import { VoiceflowSettings } from "@/components/agent-management/voiceflow/VoiceflowSettings";
import { VoiceflowKnowledgeBase } from "@/components/agent-management/voiceflow/VoiceflowKnowledgeBase";
import { VoiceflowWidget } from "@/components/agent-management/voiceflow/VoiceflowWidget";
import { VoiceflowChannels } from "@/components/agent-management/voiceflow/VoiceflowChannels";
import { RetellSettings } from "@/components/agent-management/retell/RetellSettings";
import { RetellKnowledgeBase } from "@/components/agent-management/retell/RetellKnowledgeBase";
import { RetellWidget } from "@/components/agent-management/retell/RetellWidget";
import { RetellChannels } from "@/components/agent-management/retell/RetellChannels";
import { SpecsSettings } from "@/components/agent-management/specs/SpecsSettings";
import { WidgetTestPanel } from "@/components/agent-management/voiceflow/widget/WidgetTestPanel";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useToast } from "@/hooks/use-toast";

interface Agent {
  id: string;
  name: string;
  provider: string;
  config: Record<string, any>;
  created_at: string;
  status: 'active' | 'testing' | 'in_development';
  agency_id: string;
}

interface AssignedClient {
  id: string;
  name: string;
}

export default function AgencyAgentDetails() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { profile, isPreviewMode, previewAgency } = useMultiTenantAuth();
  const agencyId = isPreviewMode ? previewAgency?.id : profile?.agency?.id;
  const { toast } = useToast();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [assignedClients, setAssignedClients] = useState<AssignedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("settings");

  useEffect(() => {
    if (agencyId) {
      loadAgentDetails();
    }
  }, [agentId, agencyId]);

  const loadAgentDetails = async () => {
    if (!agentId || !agencyId) return;

    setLoading(true);
    try {
      // Load agent details with security check
      const { data: agentData, error: agentError } = await supabase
        .from("agents")
        .select("*")
        .eq("id", agentId)
        .eq("agency_id", agencyId) // Security: verify agent belongs to agency
        .single();

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

      // Load assigned clients
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
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
        case "settings":
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
        case "settings":
          return <RetellSettings agent={agent} onUpdate={loadAgentDetails} />;
        default:
          return null;
      }
    }
    return null;
  };

  const content = (
    <div className="space-y-8">
      <AgentDetailHeader 
        agent={agent} 
        assignedClients={assignedClients} 
        onUpdate={loadAgentDetails}
        onBack={() => navigate("/agency/agents")}
        description="Agent Management Dashboard"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="widget">Widget</TabsTrigger>
          <TabsTrigger value="knowledge-base">Knowledge Base</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="specs">Specs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

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

        <TabsContent value="settings" className="space-y-6">
          {renderProviderContent("settings")}
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
