import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Save, Check, Loader2, MessageSquare } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface WidgetAppearanceSettingsProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
  onUpdate: () => void;
}

const GOOGLE_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway",
  "Nunito", "Playfair Display", "Merriweather", "Source Sans Pro", "Ubuntu"
];

const BUTTON_COLOR_PRESETS = [
  { value: "black", color: "#000000", label: "Black" },
  { value: "primary", color: null, label: "Primary" },
  { value: "white", color: "#FFFFFF", label: "White" },
];

export function WidgetAppearanceSettings({ agent, onUpdate }: WidgetAppearanceSettingsProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const lastSavedRef = useRef<string>("");

  const widgetSettings = agent.config?.widget_settings || {};
  const appearanceData = widgetSettings.appearance || {};

  const [formData, setFormData] = useState({
    appearance: {
      logo_url: appearanceData.logo_url || "",
      chat_icon_url: appearanceData.chat_icon_url || "",
      chat_button_color: appearanceData.chat_button_color || "#000000",
      primary_color: appearanceData.primary_color || "#5B4FFF",
      font_family: appearanceData.font_family || "Inter",
      widget_mode: appearanceData.widget_mode || "light",
    },
    powered_by: {
      enabled: widgetSettings.powered_by?.enabled !== false,
      text: widgetSettings.powered_by?.text || "TotalDash",
    },
  });

  const getButtonColorPreset = () => {
    const color = formData.appearance.chat_button_color;
    if (formData.appearance.chat_icon_url) return "black";
    if (color === "#000000") return "black";
    if (color === formData.appearance.primary_color) return "primary";
    if (color === "#FFFFFF" || color === "#ffffff") return "white";
    return "custom";
  };

  const [buttonColorPreset, setButtonColorPreset] = useState(getButtonColorPreset());

  useEffect(() => {
    lastSavedRef.current = JSON.stringify(formData);
  }, [agent.id]);

  useEffect(() => {
    setHasUnsavedChanges(JSON.stringify(formData) !== lastSavedRef.current);
  }, [formData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc("update_agent_config", {
        p_agent_id: agent.id,
        p_config_updates: {
          widget_settings: {
            ...widgetSettings,
            appearance: formData.appearance,
            powered_by: formData.powered_by,
          },
        },
      });

      if (error) throw error;

      lastSavedRef.current = JSON.stringify(formData);
      setHasUnsavedChanges(false);

      toast({ title: "Success", description: "Appearance saved successfully" });
      window.dispatchEvent(new Event("widget-settings-updated"));
      onUpdate();
    } catch (error) {
      console.error("Save error:", error);
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (type: "logo" | "chat_icon", file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "File size must be under 5MB", variant: "destructive" });
      return;
    }
    setUploading(type);
    try {
      const fileName = `${agent.id}/${type}-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("widget-assets").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("widget-assets").getPublicUrl(fileName);
      setFormData(prev => ({
        ...prev,
        appearance: { ...prev.appearance, [`${type}_url`]: publicUrl }
      }));
      toast({ title: "Success", description: "Image uploaded successfully" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Error", description: "Failed to upload image", variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const removeImage = (type: "logo" | "chat_icon") => {
    setFormData(prev => ({
      ...prev,
      appearance: { ...prev.appearance, [`${type}_url`]: "" }
    }));
  };

  const setButtonColor = (preset: string) => {
    setButtonColorPreset(preset);
    let color = "#000000";
    if (preset === "primary") color = formData.appearance.primary_color;
    else if (preset === "white") color = "#FFFFFF";
    else if (preset === "black") color = "#000000";
    if (preset !== "custom") {
      setFormData(prev => ({
        ...prev,
        appearance: { ...prev.appearance, chat_button_color: color }
      }));
    }
  };

  const isCustomImage = !!formData.appearance.chat_icon_url;

  const SaveButton = () => (
    <Button onClick={handleSave} disabled={!hasUnsavedChanges || isSaving} className="min-w-[140px]">
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
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Appearance</h3>
            <p className="text-sm text-muted-foreground mt-1">Visual styling for your chat widget</p>
          </div>
          <SaveButton />
        </div>
      </div>

      <div className="px-6 py-6 space-y-8">
        {/* Chat Button */}
        <div>
          <h3 className="text-base font-semibold mb-1">Chat button</h3>
          <p className="text-sm text-muted-foreground mb-4">The floating button visitors click to open the widget</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              onClick={() => {
                removeImage("chat_icon");
                setButtonColorPreset("black");
                setFormData(prev => ({
                  ...prev,
                  appearance: { ...prev.appearance, chat_icon_url: "", chat_button_color: "#000000" }
                }));
              }}
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                !isCustomImage ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <div
                className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center"
                style={{ backgroundColor: isCustomImage ? "#000000" : formData.appearance.chat_button_color }}
              >
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm font-medium">Default icon</p>
              <p className="text-xs text-muted-foreground">Customisable colour</p>
            </button>

            <div
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                isCustomImage ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              {isCustomImage ? (
                <div className="relative inline-block mb-2">
                  <img
                    src={formData.appearance.chat_icon_url}
                    alt="Custom icon"
                    className="w-12 h-12 rounded-full object-cover mx-auto"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-1 -right-1 h-5 w-5"
                    onClick={() => removeImage("chat_icon")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-2 flex items-center justify-center border border-dashed border-muted-foreground/30">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <p className="text-sm font-medium">Custom image</p>
              <p className="text-xs text-muted-foreground">Upload your own</p>
              {!isCustomImage && (
                <div className="mt-2">
                  <input
                    type="file"
                    id="upload-chat-icon"
                    className="hidden"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload("chat_icon", e.target.files[0])}
                  />
                  <label htmlFor="upload-chat-icon">
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      disabled={uploading === "chat_icon"}
                      asChild
                    >
                      <span>{uploading === "chat_icon" ? "Uploading..." : "Upload"}</span>
                    </Button>
                  </label>
                </div>
              )}
            </div>
          </div>

          {!isCustomImage && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <Label className="text-sm font-medium mb-3 block">Button colour</Label>
              <div className="flex gap-2 items-center">
                {BUTTON_COLOR_PRESETS.map((preset) => {
                  const displayColor = preset.value === "primary"
                    ? formData.appearance.primary_color
                    : (preset.color || "#000000");
                  const isActive = buttonColorPreset === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      title={preset.label}
                      onClick={() => setButtonColor(preset.value)}
                      className="relative"
                    >
                      <div
                        className={`w-8 h-8 rounded-full transition-all ${
                          isActive ? "ring-2 ring-primary ring-offset-2" : ""
                        } ${preset.value === "white" ? "border border-border" : ""}`}
                        style={{ backgroundColor: displayColor }}
                      />
                    </button>
                  );
                })}
                <div className="w-px h-6 bg-border mx-1" />
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.appearance.chat_button_color}
                    onChange={(e) => {
                      setButtonColorPreset("custom");
                      setFormData(prev => ({
                        ...prev,
                        appearance: { ...prev.appearance, chat_button_color: e.target.value }
                      }));
                    }}
                    className={`w-8 h-8 rounded-full cursor-pointer border-0 p-0 ${
                      buttonColorPreset === "custom" ? "ring-2 ring-primary ring-offset-2" : ""
                    }`}
                    style={{ WebkitAppearance: "none" }}
                  />
                  <span className="text-xs text-muted-foreground">Custom</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Brand & Colours */}
        <div>
          <h3 className="text-base font-semibold mb-1">Brand & colours</h3>
          <p className="text-sm text-muted-foreground mb-4">Your logo and colour scheme</p>

          <div className="space-y-4">
            <div>
              <Label>Logo</Label>
              <p className="text-xs text-muted-foreground mb-2">Shown in the widget header and home screen</p>
              {formData.appearance.logo_url ? (
                <div className="relative inline-block">
                  <img
                    src={formData.appearance.logo_url}
                    alt="Logo"
                    className="h-16 w-16 object-cover rounded border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => removeImage("logo")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    id="upload-logo"
                    className="hidden"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload("logo", e.target.files[0])}
                  />
                  <label htmlFor="upload-logo">
                    <Button
                      variant="outline"
                      className="cursor-pointer"
                      disabled={uploading === "logo"}
                      asChild
                    >
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading === "logo" ? "Uploading..." : "Upload Logo"}
                      </span>
                    </Button>
                  </label>
                </div>
              )}
            </div>

            <div>
              <Label>Widget mode</Label>
              <p className="text-xs text-muted-foreground mb-2">Visual theme for the chat widget</p>
              <Select
                value={formData.appearance.widget_mode}
                onValueChange={(v) =>
                  setFormData(prev => ({ ...prev, appearance: { ...prev.appearance, widget_mode: v } }))
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="auto">Auto (match website)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Primary colour</Label>
              <p className="text-xs text-muted-foreground mb-2">Used for accent stripe, user messages, and interactive elements</p>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={formData.appearance.primary_color}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      appearance: { ...prev.appearance, primary_color: e.target.value }
                    }))
                  }
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.appearance.primary_color}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      appearance: { ...prev.appearance, primary_color: e.target.value }
                    }))
                  }
                  placeholder="#000000"
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Typography */}
        <div>
          <h3 className="text-base font-semibold mb-1">Typography</h3>
          <p className="text-sm text-muted-foreground mb-4">Font used throughout the widget</p>

          <div>
            <Label>Font family</Label>
            <Select
              value={formData.appearance.font_family}
              onValueChange={(v) =>
                setFormData(prev => ({ ...prev, appearance: { ...prev.appearance, font_family: v } }))
              }
            >
              <SelectTrigger className="w-64 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOOGLE_FONTS.map(font => (
                  <SelectItem key={font} value={font}>
                    <span style={{ fontFamily: font }}>{font}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Powered By */}
        <div>
          <h3 className="text-base font-semibold mb-1">Powered by badge</h3>
          <p className="text-sm text-muted-foreground mb-4">Shown on the home screen only</p>

          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm">Show badge</Label>
            <Switch
              checked={formData.powered_by.enabled}
              onCheckedChange={(v) =>
                setFormData(prev => ({ ...prev, powered_by: { ...prev.powered_by, enabled: v } }))
              }
            />
          </div>
          {formData.powered_by.enabled && (
            <div>
              <Label className="text-sm">Badge text</Label>
              <Input
                value={formData.powered_by.text}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, powered_by: { ...prev.powered_by, text: e.target.value } }))
                }
                placeholder="TotalDash"
                className="w-64 mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Displays as "POWERED BY {(formData.powered_by.text || "TOTALDASH").toUpperCase()}"
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 bg-background border-t px-6 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {hasUnsavedChanges ? "You have unsaved changes" : "All changes saved"}
          </p>
          <SaveButton />
        </div>
      </div>
    </Card>
  );
}
