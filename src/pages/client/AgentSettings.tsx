import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { SupportRequestForm } from "@/components/agent-management/SupportRequestForm";
import { VoiceflowWidget } from "@/components/agent-management/voiceflow/VoiceflowWidget";
import { VoiceflowChannels } from "@/components/agent-management/voiceflow/VoiceflowChannels";
import { VoiceflowConversationSettings } from "@/components/agent-management/voiceflow/VoiceflowConversationSettings";
import { VoiceflowHandoverSettings } from "@/components/agent-management/voiceflow/VoiceflowHandoverSettings";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { supabase } from "@/integrations/supabase/client";

interface Agent {
  id: string;
  name: string;
  provider: string;
  config: Record<string, any>;
}

export default function AgentSettings() {
  const { selectedAgentId } = useClientAgentContext();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedAgentId) {
      loadAgent();
    } else {
      setLoading(false);
    }
  }, [selectedAgentId]);

  const loadAgent = async () => {
    if (!selectedAgentId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("agents_safe" as any)
        .select("id, name, provider, config")
        .eq("id", selectedAgentId)
        .single() as { data: any; error: any };

      if (error) throw error;
      
      setAgent({
        ...data,
        config: (data.config as Record<string, any>) || {}
      });
    } catch (error) {
      console.error("Error loading agent:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasWidgetAccess = agent?.config?.client_widget_access_enabled === true;
  const hasChannelsAccess = agent?.config?.client_channels_access_enabled === true;
  const hasConversationsAccess = agent?.config?.client_conversations_settings_enabled !== false;
  const hasHandoverAccess = agent?.config?.client_handover_settings_enabled !== false;
  const isVoiceflow = agent?.provider === "voiceflow";

  const getDefaultTab = () => {
    if (hasWidgetAccess && isVoiceflow) return "widget";
    if (hasChannelsAccess && isVoiceflow) return "channels";
    if (hasConversationsAccess && isVoiceflow) return "conversations";
    if (hasHandoverAccess && isVoiceflow) return "handover";
    return "support";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const showWidgetTab = hasWidgetAccess && isVoiceflow;
  const showChannelsTab = hasChannelsAccess && isVoiceflow;
  const showConversationsTab = hasConversationsAccess && isVoiceflow;
  const showHandoverTab = hasHandoverAccess && isVoiceflow;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Agent Settings</h1>
        <p className="text-sm text-muted-foreground">Configure and manage your agent</p>
      </div>
      
      <Tabs defaultValue={getDefaultTab()}>
        <TabsList>
          {showWidgetTab && <TabsTrigger value="widget">Widget</TabsTrigger>}
          {showChannelsTab && <TabsTrigger value="channels">Channels</TabsTrigger>}
          {showConversationsTab && <TabsTrigger value="conversations">Conversations</TabsTrigger>}
          {showHandoverTab && <TabsTrigger value="handover">Handover</TabsTrigger>}
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>
        
        {showWidgetTab && agent && (
          <TabsContent value="widget" className="mt-6">
            <VoiceflowWidget agent={agent} onUpdate={loadAgent} />
          </TabsContent>
        )}

        {showChannelsTab && agent && (
          <TabsContent value="channels" className="mt-6">
            <VoiceflowChannels agent={agent} />
          </TabsContent>
        )}

        {showConversationsTab && agent && (
          <TabsContent value="conversations" className="mt-6">
            <VoiceflowConversationSettings agent={agent} onUpdate={loadAgent} />
          </TabsContent>
        )}

        {showHandoverTab && agent && (
          <TabsContent value="handover" className="mt-6">
            <VoiceflowHandoverSettings agent={agent} onUpdate={loadAgent} />
          </TabsContent>
        )}

        <TabsContent value="support" className="mt-6">
          <Card>
            <CardContent className="p-6">
              <SupportRequestForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
