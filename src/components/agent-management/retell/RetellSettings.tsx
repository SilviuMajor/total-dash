import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { AgentDeletionDialog } from "../AgentDeletionDialog";

interface RetellSettingsProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
  onUpdate: () => void;
}

export function RetellSettings({ agent, onUpdate }: RetellSettingsProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: agent.name,
    retell_api_key: agent.config?.retell_api_key || "",
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
            retell_api_key: formData.retell_api_key,
          },
        })
        .eq("id", agent.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Retell AI settings updated successfully",
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
          <h2 className="text-xl font-semibold mb-4">Retell AI Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Configure your agent name and Retell AI API credentials to enable agent functionality.
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
            <Label htmlFor="retell_api_key">Retell AI API Key</Label>
            <div className="relative">
              <Input
                id="retell_api_key"
                type={showApiKey ? "text" : "password"}
                value={formData.retell_api_key}
                onChange={(e) =>
                  setFormData({ ...formData, retell_api_key: e.target.value })
                }
                placeholder="key_xxxxxxxx"
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
              Found in your Retell AI dashboard settings
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save Settings"}
        </Button>

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
