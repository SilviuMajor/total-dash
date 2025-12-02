import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupportRequestForm } from "@/components/agent-management/SupportRequestForm";
import { WidgetAppearanceSettings } from "@/components/agent-management/voiceflow/widget/WidgetAppearanceSettings";
import { VoiceflowChannels } from "@/components/agent-management/voiceflow/VoiceflowChannels";
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
        .from("agents")
        .select("id, name, provider, config")
        .eq("id", selectedAgentId)
        .single();

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
  const isVoiceflow = agent?.provider === "voiceflow";

  // Determine default tab based on available tabs
  const getDefaultTab = () => {
    if (hasWidgetAccess && isVoiceflow) return "widget";
    if (hasChannelsAccess && isVoiceflow) return "channels";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground">Agent Settings</h1>
        <p className="text-muted-foreground">Configure and manage your agent</p>
      </div>
      
      <Tabs defaultValue={getDefaultTab()}>
        <TabsList>
          {showWidgetTab && <TabsTrigger value="widget">Widget</TabsTrigger>}
          {showChannelsTab && <TabsTrigger value="channels">Channels</TabsTrigger>}
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>
        
        {showWidgetTab && agent && (
          <TabsContent value="widget" className="mt-6">
            <WidgetAppearanceSettings agent={agent} onUpdate={loadAgent} />
          </TabsContent>
        )}

        {showChannelsTab && agent && (
          <TabsContent value="channels" className="mt-6">
            <VoiceflowChannels agent={agent} />
          </TabsContent>
        )}

        <TabsContent value="support">
          <SupportRequestForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
