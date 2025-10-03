import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DefaultPermissionsCardProps {
  clientId: string;
}

export function DefaultPermissionsCard({ clientId }: DefaultPermissionsCardProps) {
  const [permissions, setPermissions] = useState({
    dashboard: true,
    analytics: true,
    transcripts: true,
    settings: false,
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPermissions();
  }, [clientId]);

  const loadPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('client_settings')
        .select('default_user_permissions')
        .eq('client_id', clientId)
        .single();

      if (error) throw error;

      if (data?.default_user_permissions) {
        setPermissions(data.default_user_permissions as any);
      }
    } catch (error: any) {
      console.error('Error loading default permissions:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // First check if settings exist
      const { data: existing } = await supabase
        .from('client_settings')
        .select('id')
        .eq('client_id', clientId)
        .single();

      if (existing) {
        // Update existing settings
        const { error } = await supabase
          .from('client_settings')
          .update({ default_user_permissions: permissions })
          .eq('client_id', clientId);

        if (error) throw error;
      } else {
        // Insert new settings
        const { error } = await supabase
          .from('client_settings')
          .insert({
            client_id: clientId,
            default_user_permissions: permissions,
          });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Default permissions updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6 bg-gradient-card border-border/50">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            New User Default Access
          </h3>
          <p className="text-sm text-muted-foreground">
            Set which pages new team members can access by default
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="dashboard"
              checked={permissions.dashboard}
              onCheckedChange={(checked) =>
                setPermissions({ ...permissions, dashboard: checked as boolean })
              }
            />
            <Label htmlFor="dashboard" className="font-normal cursor-pointer">
              Dashboard - View conversations and live calls
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="analytics"
              checked={permissions.analytics}
              onCheckedChange={(checked) =>
                setPermissions({ ...permissions, analytics: checked as boolean })
              }
            />
            <Label htmlFor="analytics" className="font-normal cursor-pointer">
              Analytics - View performance metrics and insights
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="transcripts"
              checked={permissions.transcripts}
              onCheckedChange={(checked) =>
                setPermissions({ ...permissions, transcripts: checked as boolean })
              }
            />
            <Label htmlFor="transcripts" className="font-normal cursor-pointer">
              Transcripts - View call transcripts and recordings
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="settings"
              checked={permissions.settings}
              onCheckedChange={(checked) =>
                setPermissions({ ...permissions, settings: checked as boolean })
              }
            />
            <Label htmlFor="settings" className="font-normal cursor-pointer">
              Settings - Manage team and client configuration
            </Label>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-foreground text-background hover:bg-foreground/90 gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Default Permissions"}
        </Button>
      </div>
    </Card>
  );
}
