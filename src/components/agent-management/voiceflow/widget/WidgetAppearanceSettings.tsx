import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Plus, Trash2, Save, Check, Loader2 } from "lucide-react";
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
  const [uploading, setUploading] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Ref to track last saved state
  const lastSavedRef = useRef<string>("");

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
      home: {
        enabled: widgetSettings.tabs?.home?.enabled !== false,
        title: widgetSettings.tabs?.home?.title || "Welcome",
        subtitle: widgetSettings.tabs?.home?.subtitle || "How can we help you today?",
        buttons: widgetSettings.tabs?.home?.buttons || [
          { id: 1, text: "Start a new chat", enabled: true, action: "new_chat" }
        ]
      },
      chats: {
        enabled: widgetSettings.tabs?.chats?.enabled !== false
      },
      faq: {
        enabled: widgetSettings.tabs?.faq?.enabled || false,
        items: widgetSettings.tabs?.faq?.items || []
      }
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
            widget_settings: formData
          }
        })
        .eq('id', agent.id);

      if (error) throw error;
      
      lastSavedRef.current = JSON.stringify(formData);
      setHasUnsavedChanges(false);
      
      toast({
        title: "Success",
        description: "Widget appearance saved successfully"
      });
      
      // Trigger parent update to reload agent data
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

  const addHomeButton = () => {
    setFormData(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        home: {
          ...prev.tabs.home,
          buttons: [
            ...prev.tabs.home.buttons,
            { id: Date.now(), text: `Button ${prev.tabs.home.buttons.length + 1}`, enabled: false, action: "custom" }
          ]
        }
      }
    }));
  };

  const removeHomeButton = (id: number) => {
    setFormData(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        home: {
          ...prev.tabs.home,
          buttons: prev.tabs.home.buttons.filter(btn => btn.id !== id)
        }
      }
    }));
  };

  const updateHomeButton = (id: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        home: {
          ...prev.tabs.home,
          buttons: prev.tabs.home.buttons.map(btn =>
            btn.id === id ? { ...btn, [field]: value } : btn
          )
        }
      }
    }));
  };

  const addFAQItem = () => {
    setFormData(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        faq: {
          ...prev.tabs.faq,
          items: [
            ...prev.tabs.faq.items,
            { question: "", answer: "" }
          ]
        }
      }
    }));
  };

  const removeFAQItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        faq: {
          ...prev.tabs.faq,
          items: prev.tabs.faq.items.filter((_, i) => i !== index)
        }
      }
    }));
  };

  const updateFAQItem = (index: number, field: 'question' | 'answer', value: string) => {
    setFormData(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        faq: {
          ...prev.tabs.faq,
          items: prev.tabs.faq.items.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
          )
        }
      }
    }));
  };

  const buttonStyles = [
    { value: 'rounded', label: 'Rounded', radius: 'rounded-lg' },
    { value: 'square', label: 'Square', radius: 'rounded-none' },
    { value: 'pill', label: 'Pill', radius: 'rounded-full' }
  ];

  return (
    <Card className="p-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background pb-4 mb-6 border-b -mt-6 -mx-6 px-6 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Widget Appearance</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure how your widget looks and feels
            </p>
          </div>
          <SaveButton />
        </div>
      </div>

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

            {/* Button Style with Visual Preview */}
            <div>
              <Label>Button Style</Label>
              <div className="grid grid-cols-3 gap-4 mt-2">
                {buttonStyles.map(style => (
                  <div
                    key={style.value}
                    className={`
                      relative cursor-pointer border-2 p-4 transition-all
                      ${formData.appearance.button_style === style.value 
                        ? 'border-primary bg-primary/5' 
                        : 'border-muted hover:border-muted-foreground/50'}
                      ${style.radius}
                    `}
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      appearance: { ...prev.appearance, button_style: style.value }
                    }))}
                  >
                    <div 
                      className={`h-10 flex items-center justify-center text-sm font-medium ${style.radius}`}
                      style={{ 
                        backgroundColor: formData.appearance.primary_color,
                        color: formData.appearance.secondary_color
                      }}
                    >
                      {style.label}
                    </div>
                    <p className="text-xs text-center mt-2 text-muted-foreground">{style.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Tab Configuration */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Tab Configuration</h3>
          <Accordion type="multiple" className="w-full">
            {/* Home Tab */}
            <AccordionItem value="home">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.tabs.home.enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      tabs: { ...prev.tabs, home: { ...prev.tabs.home, enabled: checked } }
                    }))}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>Home Tab</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={formData.tabs.home.title}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        tabs: { ...prev.tabs, home: { ...prev.tabs.home, title: e.target.value } }
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Subtitle</Label>
                    <Input
                      value={formData.tabs.home.subtitle}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        tabs: { ...prev.tabs, home: { ...prev.tabs.home, subtitle: e.target.value } }
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Quick Action Buttons</Label>
                    <div className="space-y-2 mt-2">
                      {formData.tabs.home.buttons.map(btn => (
                        <div key={btn.id} className="flex items-center gap-2 p-3 border rounded-lg">
                          <Switch
                            checked={btn.enabled}
                            onCheckedChange={(checked) => updateHomeButton(btn.id, 'enabled', checked)}
                          />
                          <Input
                            value={btn.text}
                            onChange={(e) => updateHomeButton(btn.id, 'text', e.target.value)}
                            placeholder="Button text"
                            className="flex-1"
                          />
                          <Select
                            value={btn.action}
                            onValueChange={(value) => updateHomeButton(btn.id, 'action', value)}
                          >
                            <SelectTrigger className="w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new_chat">New Chat</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeHomeButton(btn.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addHomeButton}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Button
                      </Button>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Chats Tab */}
            <AccordionItem value="chats">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.tabs.chats.enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      tabs: { ...prev.tabs, chats: { ...prev.tabs.chats, enabled: checked } }
                    }))}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>Chats Tab</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground pt-4">
                  The Chats tab shows conversation history and allows users to start new chats.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* FAQ Tab */}
            <AccordionItem value="faq">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.tabs.faq.enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      tabs: { ...prev.tabs, faq: { ...prev.tabs.faq, enabled: checked } }
                    }))}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>FAQ Tab</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4">
                  {formData.tabs.faq.items.map((item, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-2">
                      <div className="flex justify-between items-start">
                        <Label>FAQ Item {index + 1}</Label>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFAQItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        value={item.question}
                        onChange={(e) => updateFAQItem(index, 'question', e.target.value)}
                        placeholder="Question"
                      />
                      <Textarea
                        value={item.answer}
                        onChange={(e) => updateFAQItem(index, 'answer', e.target.value)}
                        placeholder="Answer"
                        rows={3}
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addFAQItem}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add FAQ Item
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 z-10 bg-background pt-4 mt-6 border-t -mb-6 -mx-6 px-6 pb-6">
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