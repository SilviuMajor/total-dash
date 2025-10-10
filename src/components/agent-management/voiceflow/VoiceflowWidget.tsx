import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WidgetAppearanceSettings } from "./widget/WidgetAppearanceSettings";
import { WidgetCodeGenerator } from "./widget/WidgetCodeGenerator";

interface VoiceflowWidgetProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
  onUpdate: () => void;
}

export function VoiceflowWidget({ agent, onUpdate }: VoiceflowWidgetProps) {
  const [activeWidgetTab, setActiveWidgetTab] = useState("appearance");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-2">Widget Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Configure your Voiceflow widget settings, appearance, and deployment code.
        </p>
      </div>

      <Tabs value={activeWidgetTab} onValueChange={setActiveWidgetTab} className="w-full">
        <TabsList>
          <TabsTrigger value="appearance">Appearance & Branding</TabsTrigger>
          <TabsTrigger value="deployment">Website Deployment</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="mt-6">
          <WidgetAppearanceSettings agent={agent} onUpdate={onUpdate} />
        </TabsContent>

        <TabsContent value="deployment" className="mt-6">
          <WidgetCodeGenerator agent={agent} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
