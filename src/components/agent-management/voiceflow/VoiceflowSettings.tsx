import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Plus, X } from "lucide-react";
import { AgentDeletionDialog } from "../AgentDeletionDialog";

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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: agent.name,
    api_key: agent.config?.api_key || "",
    project_id: agent.config?.project_id || "",
    auto_end_hours: agent.config?.auto_end_hours || agent.config?.transcript_delay_hours || 12,
  });
  const [customVariables, setCustomVariables] = useState<Array<{
    voiceflow_name: string;
    display_name: string;
  }>>(() => {
    const vars = agent.config?.custom_tracked_variables || [];
    
    // If it's the old format (array of strings), convert to new format
    if (vars.length > 0 && typeof vars[0] === 'string') {
      return vars.map((varName: string) => ({
        voiceflow_name: varName,
        display_name: varName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      }));
    }
    
    return vars;
  });

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setIsAdmin(data?.role === 'admin');
    };
    checkAdmin();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("agents")
        .update({
          name: formData.name,
          config: {
            ...agent.config,
            api_key: formData.api_key,
            project_id: formData.project_id,
            auto_end_hours: formData.auto_end_hours,
            custom_tracked_variables: customVariables.filter(v => 
              v.voiceflow_name.trim() && v.display_name.trim()
            ),
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

  const addCustomVariable = () => {
    setCustomVariables([...customVariables, { voiceflow_name: '', display_name: '' }]);
  };

  const removeCustomVariable = (index: number) => {
    setCustomVariables(customVariables.filter((_, i) => i !== index));
  };

  const updateCustomVariable = (index: number, field: 'voiceflow_name' | 'display_name', value: string) => {
    const updated = [...customVariables];
    updated[index] = { ...updated[index], [field]: value };
    setCustomVariables(updated);
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Voiceflow Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Configure your agent name and Voiceflow API credentials to enable agent functionality.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Agent Name</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter agent name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_key">Voiceflow API Key</Label>
            <div className="relative">
              <Input
                id="api_key"
                type={showApiKey ? "text" : "password"}
                value={formData.api_key}
                onChange={(e) =>
                  setFormData({ ...formData, api_key: e.target.value })
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
            <Label htmlFor="project_id">Voiceflow Project ID</Label>
            <Input
              id="project_id"
              type="text"
              value={formData.project_id}
              onChange={(e) =>
                setFormData({ ...formData, project_id: e.target.value })
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

        {/* Key Variables Section */}
        <div className="pt-6 border-t border-border">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Key Variables</h3>
              <p className="text-sm text-muted-foreground">
                Configure which Voiceflow variables are used to enhance your dashboard experience
              </p>
            </div>
            
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="px-2 py-1 bg-secondary text-secondary-foreground text-xs font-mono rounded">
                    user_name
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">User Name Variable</p>
                    <p className="text-xs text-muted-foreground">
                      When your Voiceflow agent captures this variable (e.g., through a "Capture Response" block), 
                      the conversation name in your dashboard will automatically update from "user-xxx" to the actual name.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <strong>Example:</strong> User provides "John Smith" → Conversation shows "John Smith"
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="px-2 py-1 bg-secondary text-secondary-foreground text-xs font-mono rounded">
                    user_email
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">User Email Variable</p>
                    <p className="text-xs text-muted-foreground">
                      When captured, this variable stores the user's email address for future reference.
                      You can view this in the conversation details panel.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <strong>Example:</strong> User provides "john@example.com" → Stored in conversation metadata
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-900 dark:text-blue-100">
                  <strong>💡 Setup Tip:</strong> In your Voiceflow canvas, use "Capture Response" blocks to save user inputs 
                  into variables named exactly <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded font-mono">user_name</code> and{' '}
                  <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded font-mono">user_email</code>. 
                  These will automatically sync with your dashboard.
                </p>
              </div>
            </div>

            {/* Custom Variables Section */}
            <div className="space-y-3 p-4 bg-muted rounded-lg mt-4">
              <div>
                <h4 className="text-sm font-semibold mb-1">Custom Variables (Optional)</h4>
                <p className="text-xs text-muted-foreground">
                  Add additional Voiceflow variables to track and customize how they display in the dashboard.
                </p>
              </div>
              
              <div className="space-y-2">
                {customVariables.map((variable, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-1 space-y-2">
                      <Input 
                        value={variable.voiceflow_name}
                        onChange={(e) => updateCustomVariable(index, 'voiceflow_name', e.target.value)}
                        placeholder="Voiceflow variable name (e.g., phone_number)"
                        className="font-mono text-sm"
                      />
                      <Input 
                        value={variable.display_name}
                        onChange={(e) => updateCustomVariable(index, 'display_name', e.target.value)}
                        placeholder="Display name (e.g., Phone Number)"
                      />
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => removeCustomVariable(index)}
                      className="self-start"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={addCustomVariable}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Variable
                </Button>
              </div>

              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-900 dark:text-blue-100">
                  <strong>💡 How it works:</strong>
                  <br />
                  • <strong>Voiceflow variable name:</strong> The exact variable name in your Voiceflow agent (e.g., <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded font-mono">phone_number</code>)
                  <br />
                  • <strong>Display name:</strong> How it appears in your dashboard (e.g., "Phone Number")
                </p>
              </div>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="pt-6 border-t border-border">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this agent and all associated data
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                Delete Agent
              </Button>
            </div>
          </div>
        )}
      </div>

      <AgentDeletionDialog
        agentId={agent.id}
        agentName={agent.name}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={() => {
          console.log("Delete success callback triggered");
          toast({
            title: "Success",
            description: "Agent deleted successfully"
          });
          setTimeout(() => {
            console.log("Navigating to /admin/agents");
            navigate('/admin/agents');
          }, 100);
        }}
      />
    </Card>
  );
}
