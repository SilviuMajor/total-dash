import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Plus, Trash2 } from "lucide-react";
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

export function WidgetAppearanceSettings({ agent, onUpdate }: WidgetAppearanceSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const widgetSettings = agent.config?.widget_settings || {};
  
  const [formData, setFormData] = useState({
    title: widgetSettings.title || "Chat with us",
    description: widgetSettings.description || "We're here to help",
    branding_url: widgetSettings.branding_url || "",
    appearance: {
      logo_url: widgetSettings.appearance?.logo_url || "",
      header_image_url: widgetSettings.appearance?.header_image_url || "",
      background_image_url: widgetSettings.appearance?.background_image_url || "",
      primary_color: widgetSettings.appearance?.primary_color || "#5B4FFF",
      secondary_color: widgetSettings.appearance?.secondary_color || "#FFFFFF",
      text_color: widgetSettings.appearance?.text_color || "#000000",
      font_family: widgetSettings.appearance?.font_family || "Inter",
      button_style: widgetSettings.appearance?.button_style || "rounded"
    },
    tabs: {
      enabled: widgetSettings.tabs?.enabled !== false,
      tab_names: widgetSettings.tabs?.tab_names || ["Home", "Chats"]
    }
  });

  const handleImageUpload = async (type: 'logo' | 'header' | 'background', file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be under 5MB",
        variant: "destructive"
      });
      return;
    }

    setUploading(type);
    try {
      const fileName = `${agent.id}/${type}-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('widget-assets')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('widget-assets')
        .getPublicUrl(fileName);

      setFormData(prev => ({
        ...prev,
        appearance: {
          ...prev.appearance,
          [`${type}_url`]: publicUrl
        }
      }));

      toast({
        title: "Success",
        description: "Image uploaded successfully"
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive"
      });
    } finally {
      setUploading(null);
    }
  };

  const removeImage = (type: 'logo' | 'header' | 'background') => {
    setFormData(prev => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        [`${type}_url`]: ""
      }
    }));
  };

  const addTab = () => {
    setFormData(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        tab_names: [...prev.tabs.tab_names, `Tab ${prev.tabs.tab_names.length + 1}`]
      }
    }));
  };

  const removeTab = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        tab_names: prev.tabs.tab_names.filter((_, i) => i !== index)
      }
    }));
  };

  const updateTabName = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        tab_names: prev.tabs.tab_names.map((name, i) => i === index ? value : name)
      }
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('agents')
        .update({
          config: {
            ...agent.config,
            widget_settings: formData
          }
        })
        .eq('id', agent.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Widget settings saved successfully"
      });
      onUpdate();
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      title: "Chat with us",
      description: "We're here to help",
      branding_url: "",
      appearance: {
        logo_url: "",
        header_image_url: "",
        background_image_url: "",
        primary_color: "#5B4FFF",
        secondary_color: "#FFFFFF",
        text_color: "#000000",
        font_family: "Inter",
        button_style: "rounded"
      },
      tabs: {
        enabled: true,
        tab_names: ["Home", "Chats"]
      }
    });
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Widget Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Chat with us"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="We're here to help"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="branding_url">Branding URL (optional)</Label>
              <Input
                id="branding_url"
                type="url"
                value={formData.branding_url}
                onChange={(e) => setFormData(prev => ({ ...prev, branding_url: e.target.value }))}
                placeholder="https://example.com"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Appearance */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Appearance</h3>
          <div className="space-y-6">
            {/* Image Uploads */}
            <div className="grid gap-4">
              {[
                { type: 'logo' as const, label: 'Logo', key: 'logo_url' },
                { type: 'header' as const, label: 'Header Image', key: 'header_image_url' },
                { type: 'background' as const, label: 'Background Image', key: 'background_image_url' }
              ].map(({ type, label, key }) => (
                <div key={type}>
                  <Label>{label}</Label>
                  <div className="mt-2">
                    {formData.appearance[key] ? (
                      <div className="relative inline-block">
                        <img 
                          src={formData.appearance[key]} 
                          alt={label}
                          className="h-20 w-20 object-cover rounded border"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={() => removeImage(type)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="file"
                          id={`upload-${type}`}
                          className="hidden"
                          accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                          onChange={(e) => e.target.files?.[0] && handleImageUpload(type, e.target.files[0])}
                        />
                        <label htmlFor={`upload-${type}`}>
                          <Button
                            variant="outline"
                            className="cursor-pointer"
                            disabled={uploading === type}
                            asChild
                          >
                            <span>
                              <Upload className="w-4 h-4 mr-2" />
                              {uploading === type ? 'Uploading...' : `Upload ${label}`}
                            </span>
                          </Button>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Color Pickers */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'primary_color' as const, label: 'Primary Color' },
                { key: 'secondary_color' as const, label: 'Secondary Color' },
                { key: 'text_color' as const, label: 'Text Color' }
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label htmlFor={key}>{label}</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id={key}
                      type="color"
                      value={formData.appearance[key]}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        appearance: {
                          ...prev.appearance,
                          [key]: e.target.value
                        }
                      }))}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={formData.appearance[key]}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        appearance: {
                          ...prev.appearance,
                          [key]: e.target.value
                        }
                      }))}
                      placeholder="#000000"
                      className="flex-1"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Font Family */}
            <div>
              <Label htmlFor="font_family">Font Family</Label>
              <Select
                value={formData.appearance.font_family}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  appearance: {
                    ...prev.appearance,
                    font_family: value
                  }
                }))}
              >
                <SelectTrigger id="font_family">
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

            {/* Button Style */}
            <div>
              <Label>Button Style</Label>
              <RadioGroup
                value={formData.appearance.button_style}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  appearance: {
                    ...prev.appearance,
                    button_style: value
                  }
                }))}
                className="mt-2 flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="rounded" id="rounded" />
                  <Label htmlFor="rounded" className="cursor-pointer">Rounded</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="square" id="square" />
                  <Label htmlFor="square" className="cursor-pointer">Square</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pill" id="pill" />
                  <Label htmlFor="pill" className="cursor-pointer">Pill</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>

        <Separator />

        {/* Tabs Configuration */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Tabs Configuration</h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="tabs-enabled"
                checked={formData.tabs.enabled}
                onCheckedChange={(checked) => setFormData(prev => ({
                  ...prev,
                  tabs: {
                    ...prev.tabs,
                    enabled: checked
                  }
                }))}
              />
              <Label htmlFor="tabs-enabled">Enable Tabs</Label>
            </div>

            {formData.tabs.enabled && (
              <div className="space-y-2">
                <Label>Tab Names</Label>
                {formData.tabs.tab_names.map((name, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={name}
                      onChange={(e) => updateTabName(index, e.target.value)}
                      placeholder={`Tab ${index + 1}`}
                    />
                    {formData.tabs.tab_names.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTab(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addTab}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tab
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={loading}
          >
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
