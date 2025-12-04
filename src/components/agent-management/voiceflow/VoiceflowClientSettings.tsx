import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VoiceflowClientSettingsProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
  onUpdate: () => void;
}

export function VoiceflowClientSettings({ agent, onUpdate }: VoiceflowClientSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [autoEndHours, setAutoEndHours] = useState(
    agent.config?.auto_end_hours || agent.config?.transcript_delay_hours || 12
  );
  const [autoEndMode, setAutoEndMode] = useState<'since_start' | 'since_last_message'>(
    agent.config?.auto_end_mode || 'since_last_message'
  );

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("agents")
        .update({
          config: {
            ...agent.config,
            auto_end_hours: autoEndHours,
            auto_end_mode: autoEndMode,
          },
        })
        .eq("id", agent.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Settings updated successfully",
      });
      onUpdate();
    } catch (error) {
      console.error("Error updating settings:", error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDescriptionText = () => {
    if (autoEndMode === 'since_start') {
      return `Conversations will be automatically ended ${autoEndHours} hour${autoEndHours !== 1 ? 's' : ''} after they start, regardless of activity.`;
    }
    return `Conversations without activity for ${autoEndHours} hour${autoEndHours !== 1 ? 's' : ''} will be automatically ended.`;
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Conversation Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure how conversations are managed for this agent.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Conversation Auto-End</h3>
            <p className="text-sm text-muted-foreground">
              Automatically end conversations and create read-only transcripts
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Auto-end based on</Label>
              <RadioGroup
                value={autoEndMode}
                onValueChange={(value) => setAutoEndMode(value as 'since_start' | 'since_last_message')}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="since_last_message" id="since_last_message" />
                  <Label htmlFor="since_last_message" className="font-normal cursor-pointer">
                    Since last message (inactivity)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="since_start" id="since_start" />
                  <Label htmlFor="since_start" className="font-normal cursor-pointer">
                    Since conversation start
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="auto_end_hours">Auto-end after</Label>
              <Select
                value={autoEndHours.toString()}
                onValueChange={(value) => setAutoEndHours(parseInt(value))}
              >
                <SelectTrigger id="auto_end_hours" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="2">2 hours</SelectItem>
                  <SelectItem value="4">4 hours</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="8">8 hours</SelectItem>
                  <SelectItem value="12">12 hours (default)</SelectItem>
                  <SelectItem value="18">18 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {getDescriptionText()}
              </p>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </Card>
  );
}
