import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
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
      notification_sound_enabled: widgetSettings.functions?.notification_sound_enabled !== false,
      message_text_color: widgetSettings.functions?.message_text_color || "#000000",
      message_background_color: widgetSettings.functions?.message_background_color || "#f3f4f6",
      font_size: widgetSettings.functions?.font_size || "14px",
      typing_delay_ms: widgetSettings.functions?.typing_delay_ms || 500
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
    <Card className="overflow-hidden">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
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

      <div className="px-6 py-6 space-y-8">
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

        <Separator />

        {/* Message Appearance */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Message Appearance</h3>
          <div className="space-y-6">
            
            {/* Message Text Color */}
            <div className="space-y-2">
              <Label htmlFor="message_text_color">Message Text Color</Label>
              <div className="flex gap-2">
                <Input
                  id="message_text_color"
                  type="color"
                  value={formData.functions.message_text_color}
                  onChange={(e) => 
                    setFormData(prev => ({
                      ...prev,
                      functions: {
                        ...prev.functions,
                        message_text_color: e.target.value
                      }
                    }))
                  }
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.functions.message_text_color}
                  onChange={(e) => 
                    setFormData(prev => ({
                      ...prev,
                      functions: {
                        ...prev.functions,
                        message_text_color: e.target.value
                      }
                    }))
                  }
                  placeholder="#000000"
                  className="flex-1 font-mono"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Color for bot message text
              </p>
            </div>

            {/* Bot Message Background Color */}
            <div className="space-y-2">
              <Label htmlFor="message_background_color">Bot Message Background Color</Label>
              <div className="flex gap-2">
                <Input
                  id="message_background_color"
                  type="color"
                  value={formData.functions.message_background_color}
                  onChange={(e) => 
                    setFormData(prev => ({
                      ...prev,
                      functions: {
                        ...prev.functions,
                        message_background_color: e.target.value
                      }
                    }))
                  }
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.functions.message_background_color}
                  onChange={(e) => 
                    setFormData(prev => ({
                      ...prev,
                      functions: {
                        ...prev.functions,
                        message_background_color: e.target.value
                      }
                    }))
                  }
                  placeholder="#f3f4f6"
                  className="flex-1 font-mono"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Background color for bot message bubbles
              </p>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <Label htmlFor="font_size">Font Size</Label>
              <div className="flex gap-4 items-center">
                <Slider
                  id="font_size"
                  min={12}
                  max={24}
                  step={1}
                  value={[parseInt(formData.functions.font_size)]}
                  onValueChange={(value) => 
                    setFormData(prev => ({
                      ...prev,
                      functions: {
                        ...prev.functions,
                        font_size: `${value[0]}px`
                      }
                    }))
                  }
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={parseInt(formData.functions.font_size)}
                  onChange={(e) => 
                    setFormData(prev => ({
                      ...prev,
                      functions: {
                        ...prev.functions,
                        font_size: `${e.target.value}px`
                      }
                    }))
                  }
                  className="w-20"
                  min={12}
                  max={24}
                />
                <span className="text-sm text-muted-foreground">px</span>
              </div>
            </div>

            {/* Typing Delay */}
            <div className="space-y-2">
              <Label htmlFor="typing_delay">Typing Delay</Label>
              <div className="flex gap-4 items-center">
                <Slider
                  id="typing_delay"
                  min={100}
                  max={3000}
                  step={100}
                  value={[formData.functions.typing_delay_ms]}
                  onValueChange={(value) => 
                    setFormData(prev => ({
                      ...prev,
                      functions: {
                        ...prev.functions,
                        typing_delay_ms: value[0]
                      }
                    }))
                  }
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={formData.functions.typing_delay_ms}
                  onChange={(e) => 
                    setFormData(prev => ({
                      ...prev,
                      functions: {
                        ...prev.functions,
                        typing_delay_ms: parseInt(e.target.value) || 500
                      }
                    }))
                  }
                  className="w-24"
                  min={100}
                  max={3000}
                  step={100}
                />
                <span className="text-sm text-muted-foreground">ms</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Delay between sequential messages (default: 500ms)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 z-10 bg-background border-t px-6 py-4">
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
