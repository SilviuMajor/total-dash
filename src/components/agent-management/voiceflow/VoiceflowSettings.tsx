import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

interface VoiceflowSettingsProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
  onUpdate: () => void;
}

export function VoiceflowSettings({ agent, onUpdate }: VoiceflowSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState({
    voiceflow_api_key: agent.config?.voiceflow_api_key || "",
    voiceflow_project_id: agent.config?.voiceflow_project_id || "",
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("agents")
        .update({
          config: {
            ...agent.config,
            voiceflow_api_key: formData.voiceflow_api_key,
            voiceflow_project_id: formData.voiceflow_project_id,
          },
        })
        .eq("id", agent.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Voiceflow settings updated successfully",
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

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Voiceflow Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Configure your Voiceflow API credentials to enable agent functionality.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="voiceflow_api_key">Voiceflow API Key</Label>
            <div className="relative">
              <Input
                id="voiceflow_api_key"
                type={showApiKey ? "text" : "password"}
                value={formData.voiceflow_api_key}
                onChange={(e) =>
                  setFormData({ ...formData, voiceflow_api_key: e.target.value })
                }
                placeholder="VF.xxxxxxxx.xxxxxxxx"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Found in your Voiceflow workspace settings
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voiceflow_project_id">Voiceflow Project ID</Label>
            <Input
              id="voiceflow_project_id"
              type="text"
              value={formData.voiceflow_project_id}
              onChange={(e) =>
                setFormData({ ...formData, voiceflow_project_id: e.target.value })
              }
              placeholder="proj_xxxxxxxx"
            />
            <p className="text-xs text-muted-foreground">
              Found in your Voiceflow project settings
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </Card>
  );
}
