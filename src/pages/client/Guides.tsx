import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { VoiceflowGuides } from "@/components/guides/VoiceflowGuides";
import { RetellGuides } from "@/components/guides/RetellGuides";
import { BookOpen } from "lucide-react";

interface GuideSection {
  id: string;
  title: string;
  content: string;
  sort_order: number;
}

export default function Guides() {
  const { user } = useAuth();
  const { selectedAgentId } = useClientAgentContext();
  const [customGuideSections, setCustomGuideSections] = useState<GuideSection[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [agentProvider, setAgentProvider] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      // Get client ID
      const { data: clientUserData } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', user.id)
        .single();

      if (clientUserData) {
        setClientId(clientUserData.client_id);

        // Load client-specific guides
        const { data: settingsData } = await supabase
          .from('client_settings')
          .select('custom_guide_sections')
          .eq('client_id', clientUserData.client_id)
          .single();

        if (settingsData?.custom_guide_sections && Array.isArray(settingsData.custom_guide_sections)) {
          setCustomGuideSections(settingsData.custom_guide_sections as unknown as GuideSection[]);
        }
      }

      // Get agent provider for showing relevant default guides
      if (selectedAgentId) {
        const { data: agentData } = await supabase
          .from('agents')
          .select('provider')
          .eq('id', selectedAgentId)
          .single();

        if (agentData) {
          setAgentProvider(agentData.provider);
        }
      }
    };

    loadData();
  }, [user, selectedAgentId]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <BookOpen className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-4xl font-bold text-foreground">Guides & Documentation</h1>
          <p className="text-muted-foreground">Learn how to use your agents effectively</p>
        </div>
      </div>

      {/* Default How-To Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use Your Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {agentProvider === 'voiceflow' && <VoiceflowGuides />}
            {agentProvider === 'retell' && <RetellGuides />}
            {!agentProvider && (
              <div className="text-muted-foreground text-center py-8">
                Select an agent to view specific documentation
              </div>
            )}
          </Accordion>
        </CardContent>
      </Card>

      {/* Client-Specific Guides */}
      {customGuideSections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {customGuideSections
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((section) => (
                  <AccordionItem key={section.id} value={section.id}>
                    <AccordionTrigger>{section.title}</AccordionTrigger>
                    <AccordionContent>
                      <div 
                        className="prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: section.content }} 
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
