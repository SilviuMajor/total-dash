import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Check, Loader2, Plus, Trash2, Phone, MessageSquare, Link } from "lucide-react";
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
    welcome_message: {
      enabled: widgetSettings.welcome_message?.enabled || false,
      text: widgetSettings.welcome_message?.text || "👋 Hi there! How can I help you today?",
      delay_ms: widgetSettings.welcome_message?.delay_ms || 1500,
      auto_dismiss_seconds: widgetSettings.welcome_message?.auto_dismiss_seconds || 0,
    },
    tabs: {
      home: {
        enabled: widgetSettings.tabs?.home?.enabled !== false,
        title: widgetSettings.tabs?.home?.title || "Welcome",
        subtitle: widgetSettings.tabs?.home?.subtitle || "How can we help you today?",
        buttons: widgetSettings.tabs?.home?.buttons || [
          { id: 1, text: "Start a new chat", enabled: true, action: "new_chat" },
        ],
      },
      chats: {
        enabled: widgetSettings.tabs?.chats?.enabled !== false,
      },
      faq: {
        enabled: widgetSettings.tabs?.faq?.enabled || false,
        items: widgetSettings.tabs?.faq?.items || [],
      },
    },
    functions: {
      notification_sound_enabled: widgetSettings.functions?.notification_sound_enabled !== false,
      file_upload_enabled: widgetSettings.functions?.file_upload_enabled || false,
      typing_delay_ms: widgetSettings.functions?.typing_delay_ms || 500,
    },
  });

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
            welcome_message: formData.welcome_message,
            tabs: formData.tabs,
            functions: {
              ...widgetSettings.functions,
              notification_sound_enabled: formData.functions.notification_sound_enabled,
              file_upload_enabled: formData.functions.file_upload_enabled,
              typing_delay_ms: formData.functions.typing_delay_ms,
            },
          },
        },
      });

      if (error) throw error;

      lastSavedRef.current = JSON.stringify(formData);
      setHasUnsavedChanges(false);

      toast({ title: "Success", description: "Content & behavior saved successfully" });
      window.dispatchEvent(new Event("widget-settings-updated"));
      onUpdate();
    } catch (error) {
      console.error("Save error:", error);
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Home button helpers
  const addHomeButton = () => {
    setFormData(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        home: {
          ...prev.tabs.home,
          buttons: [
            ...prev.tabs.home.buttons,
            { id: Date.now(), text: `Button ${prev.tabs.home.buttons.length + 1}`, enabled: false, action: "custom" },
          ],
        },
      },
    }));
  };

  const removeHomeButton = (id: number) => {
    setFormData(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        home: {
          ...prev.tabs.home,
          buttons: prev.tabs.home.buttons.filter((btn: any) => btn.id !== id),
        },
      },
    }));
  };

  const updateHomeButton = (id: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        home: {
          ...prev.tabs.home,
          buttons: prev.tabs.home.buttons.map((btn: any) =>
            btn.id === id ? { ...btn, [field]: value } : btn
          ),
        },
      },
    }));
  };

  // FAQ helpers
  const addFAQItem = () => {
    setFormData(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        faq: {
          ...prev.tabs.faq,
          items: [...prev.tabs.faq.items, { question: "", answer: "" }],
        },
      },
    }));
  };

  const removeFAQItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        faq: {
          ...prev.tabs.faq,
          items: prev.tabs.faq.items.filter((_: any, i: number) => i !== index),
        },
      },
    }));
  };

  const updateFAQItem = (index: number, field: "question" | "answer", value: string) => {
    setFormData(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        faq: {
          ...prev.tabs.faq,
          items: prev.tabs.faq.items.map((item: any, i: number) =>
            i === index ? { ...item, [field]: value } : item
          ),
        },
      },
    }));
  };

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
            <h3 className="text-lg font-semibold">Content & behavior</h3>
            <p className="text-sm text-muted-foreground mt-1">Home screen content, tabs, and widget behavior</p>
          </div>
          <SaveButton />
        </div>
      </div>

      <div className="px-6 py-6 space-y-8">
        {/* Home Screen */}
        <div>
          <h3 className="text-base font-semibold mb-1">Home screen</h3>
          <p className="text-sm text-muted-foreground mb-4">What visitors see when they first open the widget</p>

          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={formData.tabs.home.title}
                onChange={(e) =>
                  setFormData(prev => ({
                    ...prev,
                    tabs: { ...prev.tabs, home: { ...prev.tabs.home, title: e.target.value } },
                  }))
                }
                placeholder="Welcome"
              />
            </div>
            <div>
              <Label>Subtitle</Label>
              <Input
                value={formData.tabs.home.subtitle}
                onChange={(e) =>
                  setFormData(prev => ({
                    ...prev,
                    tabs: { ...prev.tabs, home: { ...prev.tabs.home, subtitle: e.target.value } },
                  }))
                }
                placeholder="How can we help you today?"
              />
            </div>

            <div>
              <Label>Quick action buttons</Label>
              <p className="text-xs text-muted-foreground mb-2">Buttons shown on the home screen</p>
              <div className="space-y-2">
                {formData.tabs.home.buttons.map((btn: any) => (
                  <div key={btn.id} className="flex items-center gap-2 p-3 border rounded-lg">
                    <Switch
                      checked={btn.enabled}
                      onCheckedChange={(checked) => updateHomeButton(btn.id, "enabled", checked)}
                    />
                    <Input
                      value={btn.text}
                      onChange={(e) => updateHomeButton(btn.id, "text", e.target.value)}
                      placeholder="Button text"
                      className="flex-1"
                    />
                    <Select
                      value={btn.action}
                      onValueChange={(value) => updateHomeButton(btn.id, "action", value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new_chat">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            <span>New Chat</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="call">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            <span>Call</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="custom">
                          <div className="flex items-center gap-2">
                            <Link className="w-4 h-4" />
                            <span>Custom</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {btn.action === "call" && (
                      <Input
                        type="tel"
                        placeholder="+44 123 456 7890"
                        value={btn.phoneNumber || ""}
                        onChange={(e) => updateHomeButton(btn.id, "phoneNumber", e.target.value)}
                        className="w-40"
                      />
                    )}
                    <Button variant="ghost" size="icon" onClick={() => removeHomeButton(btn.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addHomeButton} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Button
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Welcome Message */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold">Welcome message</h3>
            <Switch
              checked={formData.welcome_message.enabled}
              onCheckedChange={(checked) =>
                setFormData(prev => ({
                  ...prev,
                  welcome_message: { ...prev.welcome_message, enabled: checked },
                }))
              }
            />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            A popup bubble shown above the chat button before the visitor opens the widget
          </p>

          {formData.welcome_message.enabled && (
            <div className="space-y-4">
              <div>
                <Label>Message text</Label>
                <Input
                  value={formData.welcome_message.text}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      welcome_message: { ...prev.welcome_message, text: e.target.value.slice(0, 120) },
                    }))
                  }
                  placeholder="👋 Hi there! How can I help you today?"
                  maxLength={120}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.welcome_message.text.length}/120 characters
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Show delay</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      min={0}
                      max={10000}
                      step={100}
                      value={formData.welcome_message.delay_ms}
                      onChange={(e) =>
                        setFormData(prev => ({
                          ...prev,
                          welcome_message: { ...prev.welcome_message, delay_ms: parseInt(e.target.value) || 1500 },
                        }))
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">ms</span>
                  </div>
                </div>
                <div>
                  <Label>Auto-dismiss</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={formData.welcome_message.auto_dismiss_seconds}
                      onChange={(e) =>
                        setFormData(prev => ({
                          ...prev,
                          welcome_message: {
                            ...prev.welcome_message,
                            auto_dismiss_seconds: parseInt(e.target.value) || 0,
                          },
                        }))
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">sec (0 = manual)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Tabs Configuration */}
        <div>
          <h3 className="text-base font-semibold mb-1">Tabs</h3>
          <p className="text-sm text-muted-foreground mb-4">Control which tabs appear in the widget navigation</p>

          <Accordion type="multiple" className="w-full">
            <AccordionItem value="home">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.tabs.home.enabled}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({
                        ...prev,
                        tabs: { ...prev.tabs, home: { ...prev.tabs.home, enabled: checked } },
                      }))
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>Home tab</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground pt-2">
                  The landing screen with your title, subtitle, and action buttons. Configure the content in the "Home screen" section above.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="chats">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.tabs.chats.enabled}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({
                        ...prev,
                        tabs: { ...prev.tabs, chats: { ...prev.tabs.chats, enabled: checked } },
                      }))
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>Chats tab</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground pt-2">
                  Shows conversation history and allows users to start new chats or continue previous ones.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.tabs.faq.enabled}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({
                        ...prev,
                        tabs: { ...prev.tabs, faq: { ...prev.tabs.faq, enabled: checked } },
                      }))
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>FAQ tab</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {formData.tabs.faq.items.map((item: any, index: number) => (
                    <div key={index} className="p-4 border rounded-lg space-y-2">
                      <div className="flex justify-between items-start">
                        <Label>FAQ item {index + 1}</Label>
                        <Button variant="ghost" size="icon" onClick={() => removeFAQItem(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        value={item.question}
                        onChange={(e) => updateFAQItem(index, "question", e.target.value)}
                        placeholder="Question"
                      />
                      <Textarea
                        value={item.answer}
                        onChange={(e) => updateFAQItem(index, "answer", e.target.value)}
                        placeholder="Answer"
                        rows={3}
                      />
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addFAQItem} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add FAQ Item
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <Separator />

        {/* Behavior */}
        <div>
          <h3 className="text-base font-semibold mb-1">Behavior</h3>
          <p className="text-sm text-muted-foreground mb-4">Control widget functionality</p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <Label className="text-sm font-medium">Notification sound</Label>
                <p className="text-xs text-muted-foreground">Play a sound when new messages arrive</p>
              </div>
              <Switch
                checked={formData.functions.notification_sound_enabled}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({
                    ...prev,
                    functions: { ...prev.functions, notification_sound_enabled: checked },
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <Label className="text-sm font-medium">File upload</Label>
                <p className="text-xs text-muted-foreground">Allow users to upload files and images</p>
              </div>
              <Switch
                checked={formData.functions.file_upload_enabled}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({
                    ...prev,
                    functions: { ...prev.functions, file_upload_enabled: checked },
                  }))
                }
              />
            </div>

            <div className="p-4 rounded-lg border">
              <Label className="text-sm font-medium">Typing delay</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Delay between sequential bot messages (simulates typing)
              </p>
              <div className="flex gap-4 items-center">
                <Slider
                  min={100}
                  max={3000}
                  step={100}
                  value={[formData.functions.typing_delay_ms]}
                  onValueChange={(value) =>
                    setFormData(prev => ({
                      ...prev,
                      functions: { ...prev.functions, typing_delay_ms: value[0] },
                    }))
                  }
                  className="flex-1"
                />
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={formData.functions.typing_delay_ms}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        functions: { ...prev.functions, typing_delay_ms: parseInt(e.target.value) || 500 },
                      }))
                    }
                    className="w-20"
                    min={100}
                    max={3000}
                    step={100}
                  />
                  <span className="text-xs text-muted-foreground">ms</span>
                </div>
              </div>
            </div>
          </div>
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
