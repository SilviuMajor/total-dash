import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Check, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface WidgetFunctionsSettingsProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
  onUpdate: () => void;
}

export function WidgetFunctionsSettings({ agent, onUpdate }: WidgetFunctionsSettingsProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const lastSavedRef = useRef<string>("");

  const widgetSettings = agent.config?.widget_settings || {};
  
  const [formData, setFormData] = useState({
    functions: {
      notification_sound_enabled: widgetSettings.functions?.notification_sound_enabled !== false
    }
  });

  // Initialize lastSaved on mount
  useEffect(() => {
    lastSavedRef.current = JSON.stringify(formData);
  }, [agent.id]);

  // Track changes
  useEffect(() => {
    const currentData = JSON.stringify(formData);
    setHasUnsavedChanges(currentData !== lastSavedRef.current);
  }, [formData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('agents')
        .update({
          config: {
            ...agent.config,
            widget_settings: {
              ...widgetSettings,
              ...formData
            }
          }
        })
        .eq('id', agent.id);

      if (error) throw error;
      
      lastSavedRef.current = JSON.stringify(formData);
      setHasUnsavedChanges(false);
      
      toast({
        title: "Success",
        description: "Widget functions saved successfully"
      });
      
      onUpdate();
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const SaveButton = () => (
    <Button 
      onClick={handleSave}
      disabled={!hasUnsavedChanges || isSaving}
      className="min-w-[140px]"
    >
      {isSaving ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Saving...
        </>
      ) : hasUnsavedChanges ? (
        <>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </>
      ) : (
        <>
          <Check className="h-4 w-4 mr-2" />
          Saved
        </>
      )}
    </Button>
  );

  return (
    <Card>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background pb-4 border-b px-6 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Widget Functions</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure widget behavior and functionality
            </p>
          </div>
          <SaveButton />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Notifications */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Notifications</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="space-y-0.5">
                <Label htmlFor="notification_sound" className="text-base">
                  Notification Sound
                </Label>
                <p className="text-sm text-muted-foreground">
                  Play a sound when new messages arrive
                </p>
              </div>
              <Switch
                id="notification_sound"
                checked={formData.functions.notification_sound_enabled}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({
                    ...prev,
                    functions: {
                      ...prev.functions,
                      notification_sound_enabled: checked
                    }
                  }))
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 z-10 bg-background pt-4 border-t px-6 pb-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {hasUnsavedChanges ? 'You have unsaved changes' : 'All changes saved'}
          </p>
          <SaveButton />
        </div>
      </div>
    </Card>
  );
}
