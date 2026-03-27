import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, Check, X, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface VoiceflowClientSettingsProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
  onUpdate: () => void;
}

interface CannedResponse {
  id: string;
  agent_id: string | null;
  user_id: string | null;
  category: string;
  title: string;
  body: string;
  sort_order: number;
}

export function VoiceflowClientSettings({ agent, onUpdate }: VoiceflowClientSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [autoEndHours, setAutoEndHours] = useState(
    agent.config?.auto_end_hours || agent.config?.transcript_delay_hours || 12
  );
  const [autoEndMode, setAutoEndMode] = useState<'since_start' | 'since_last_message'>(
    agent.config?.auto_end_mode || 'since_last_message'
  );
  const [responseGreenSeconds, setResponseGreenSeconds] = useState(
    agent.config?.response_thresholds?.green_seconds || 60
  );
  const [responseAmberSeconds, setResponseAmberSeconds] = useState(
    agent.config?.response_thresholds?.amber_seconds || 300
  );

  // Handover inactivity settings
  const [nudgeEnabled, setNudgeEnabled] = useState(
    agent.config?.handover_inactivity?.nudge_enabled !== false
  );
  const [nudgeDelayMinutes, setNudgeDelayMinutes] = useState(
    agent.config?.handover_inactivity?.nudge_delay_minutes || 5
  );
  const [nudgeMessage, setNudgeMessage] = useState(
    agent.config?.handover_inactivity?.nudge_message || "Are you still there? Let us know if you need anything else."
  );
  const [nudgeRepeat, setNudgeRepeat] = useState<'once' | 'repeat'>(
    agent.config?.handover_inactivity?.nudge_repeat || 'once'
  );
  const [nudgeRepeatInterval, setNudgeRepeatInterval] = useState(
    agent.config?.handover_inactivity?.nudge_repeat_interval_minutes || 5
  );
  const [hardTimeoutEnabled, setHardTimeoutEnabled] = useState(
    agent.config?.handover_inactivity?.hard_timeout_enabled !== false
  );
  const [hardTimeoutMinutes, setHardTimeoutMinutes] = useState(
    agent.config?.handover_inactivity?.hard_timeout_minutes || 20
  );

  // Canned responses
  const [personalEnabled, setPersonalEnabled] = useState(
    agent.config?.canned_responses_personal_enabled !== false
  );
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [cannedLoading, setCannedLoading] = useState(false);
  const [showAddCanned, setShowAddCanned] = useState(false);
  const [newCannedCategory, setNewCannedCategory] = useState("General");
  const [newCannedTitle, setNewCannedTitle] = useState("");
  const [newCannedBody, setNewCannedBody] = useState("");
  const [editingCannedId, setEditingCannedId] = useState<string | null>(null);
  const [editCannedTitle, setEditCannedTitle] = useState("");
  const [editCannedBody, setEditCannedBody] = useState("");
  const [editCannedCategory, setEditCannedCategory] = useState("");
  const [deleteCannedId, setDeleteCannedId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCannedResponses();
  }, [agent.id]);

  const loadCannedResponses = async () => {
    setCannedLoading(true);
    const { data } = await supabase
      .from("canned_responses")
      .select("*")
      .eq("agent_id", agent.id)
      .order("category")
      .order("sort_order");
    setCannedResponses(data || []);
    setCannedLoading(false);
  };

  const addCannedResponse = async () => {
    if (!newCannedTitle.trim() || !newCannedBody.trim()) return;
    await supabase.from("canned_responses").insert({
      agent_id: agent.id,
      category: newCannedCategory.trim() || "General",
      title: newCannedTitle.trim(),
      body: newCannedBody.trim(),
      sort_order: cannedResponses.length,
    });
    setNewCannedTitle(""); setNewCannedBody(""); setShowAddCanned(false);
    loadCannedResponses();
    toast({ title: "Added", description: "Canned response created" });
  };

  const saveCannedEdit = async (id: string) => {
    await supabase.from("canned_responses").update({
      title: editCannedTitle.trim(),
      body: editCannedBody.trim(),
      category: editCannedCategory.trim() || "General",
    }).eq("id", id);
    setEditingCannedId(null);
    loadCannedResponses();
  };

  const deleteCannedResponse = async (id: string) => {
    await supabase.from("canned_responses").delete().eq("id", id);
    setDeleteCannedId(null);
    loadCannedResponses();
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("agents")
        .update({
          config: {
            ...agent.config,
            auto_end_hours: autoEndHours,
            auto_end_mode: autoEndMode,
            response_thresholds: {
              green_seconds: responseGreenSeconds,
              amber_seconds: responseAmberSeconds,
            },
            handover_inactivity: {
              nudge_enabled: nudgeEnabled,
              nudge_delay_minutes: nudgeDelayMinutes,
              nudge_message: nudgeMessage,
              nudge_repeat: nudgeRepeat,
              nudge_repeat_interval_minutes: nudgeRepeatInterval,
              hard_timeout_enabled: hardTimeoutEnabled,
              hard_timeout_minutes: hardTimeoutMinutes,
            },
            canned_responses_personal_enabled: personalEnabled,
          },
        })
        .eq("id", agent.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Settings updated successfully",
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

  const getDescriptionText = () => {
    if (autoEndMode === 'since_start') {
      return `Conversations will be automatically ended ${autoEndHours} hour${autoEndHours !== 1 ? 's' : ''} after they start, regardless of activity.`;
    }
    return `Conversations without activity for ${autoEndHours} hour${autoEndHours !== 1 ? 's' : ''} will be automatically ended.`;
  };

  const cannedCategories = [...new Set(cannedResponses.map(r => r.category))].sort();
  const existingCannedCategories = cannedCategories.length > 0 ? cannedCategories : ["General"];

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Conversation Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure how conversations are managed for this agent.
          </p>
        </div>

        {/* Conversation Auto-End */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Conversation Auto-End</h3>
            <p className="text-sm text-muted-foreground">
              Automatically end conversations and create read-only transcripts
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Auto-end based on</Label>
              <RadioGroup
                value={autoEndMode}
                onValueChange={(value) => setAutoEndMode(value as 'since_start' | 'since_last_message')}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="since_last_message" id="since_last_message" />
                  <Label htmlFor="since_last_message" className="font-normal cursor-pointer">
                    Since last message (inactivity)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="since_start" id="since_start" />
                  <Label htmlFor="since_start" className="font-normal cursor-pointer">
                    Since conversation start
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="auto_end_hours">Auto-end after</Label>
              <Select
                value={autoEndHours.toString()}
                onValueChange={(value) => setAutoEndHours(parseInt(value))}
              >
                <SelectTrigger id="auto_end_hours" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="2">2 hours</SelectItem>
                  <SelectItem value="4">4 hours</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="8">8 hours</SelectItem>
                  <SelectItem value="12">12 hours (default)</SelectItem>
                  <SelectItem value="18">18 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {getDescriptionText()}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Handover Inactivity */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Handover Inactivity</h3>
            <p className="text-sm text-muted-foreground">Configure what happens when a customer goes inactive during a live handover</p>
          </div>

          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Inactivity Nudge</Label>
                <p className="text-xs text-muted-foreground">Send a reminder when the customer hasn't responded</p>
              </div>
              <Switch checked={nudgeEnabled} onCheckedChange={setNudgeEnabled} />
            </div>

            {nudgeEnabled && (
              <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                <div className="space-y-1.5">
                  <Label className="text-sm">Send after (minutes)</Label>
                  <Input type="number" min={1} max={60} value={nudgeDelayMinutes} onChange={(e) => setNudgeDelayMinutes(Math.max(1, parseInt(e.target.value) || 1))} className="w-32" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Nudge message</Label>
                  <Textarea value={nudgeMessage} onChange={(e) => setNudgeMessage(e.target.value)} placeholder="Are you still there?" className="min-h-[60px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Repeat behaviour</Label>
                  <RadioGroup value={nudgeRepeat} onValueChange={(v) => setNudgeRepeat(v as 'once' | 'repeat')} className="flex flex-col gap-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="once" id="nudge_once" />
                      <Label htmlFor="nudge_once" className="font-normal cursor-pointer text-sm">Send once</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="repeat" id="nudge_repeat" />
                      <Label htmlFor="nudge_repeat" className="font-normal cursor-pointer text-sm">Repeat until customer responds</Label>
                    </div>
                  </RadioGroup>
                </div>
                {nudgeRepeat === 'repeat' && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Repeat interval (minutes)</Label>
                    <Input type="number" min={1} max={60} value={nudgeRepeatInterval} onChange={(e) => setNudgeRepeatInterval(Math.max(1, parseInt(e.target.value) || 1))} className="w-32" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Hard Inactivity Timeout</Label>
                <p className="text-xs text-muted-foreground">End the handover if the customer is inactive too long</p>
              </div>
              <Switch checked={hardTimeoutEnabled} onCheckedChange={setHardTimeoutEnabled} />
            </div>
            {hardTimeoutEnabled && (
              <div className="space-y-1.5">
                <Label className="text-sm">End handover after (minutes)</Label>
                <Input type="number" min={5} max={120} value={hardTimeoutMinutes} onChange={(e) => setHardTimeoutMinutes(Math.max(5, parseInt(e.target.value) || 5))} className="w-32" />
                <p className="text-xs text-muted-foreground">Handover ends after {hardTimeoutMinutes} minutes of customer inactivity.</p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Response Time Thresholds */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div>
            <Label className="text-sm font-medium">Response Time Indicators</Label>
            <p className="text-xs text-muted-foreground">Colour thresholds for the waiting time indicator on conversation cards</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Green until (seconds)
              </Label>
              <Input
                type="number"
                min={10}
                max={600}
                value={responseGreenSeconds}
                onChange={(e) => setResponseGreenSeconds(Math.max(10, parseInt(e.target.value) || 10))}
                className="w-28"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                Amber until (seconds)
              </Label>
              <Input
                type="number"
                min={30}
                max={1800}
                value={responseAmberSeconds}
                onChange={(e) => setResponseAmberSeconds(Math.max(30, parseInt(e.target.value) || 30))}
                className="w-28"
              />
            </div>
            <div className="space-y-1.5 pt-5">
              <Label className="text-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Red after
              </Label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Default: Green under {responseGreenSeconds}s, Amber {responseGreenSeconds}s–{responseAmberSeconds}s, Red over {responseAmberSeconds}s
          </p>
        </div>

        <Separator />

        {/* Canned Responses */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Canned Responses</h3>
            <p className="text-sm text-muted-foreground">Pre-configured templates agents can use during handovers</p>
          </div>

          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Personal Canned Responses</Label>
                <p className="text-xs text-muted-foreground">Allow agents to create their own personal responses</p>
              </div>
              <Switch checked={personalEnabled} onCheckedChange={setPersonalEnabled} />
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/30 dark:border-blue-800">
            <div className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">Available Variables</div>
            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
              <div><code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">{"{{agent_name}}"}</code> — Agent's name</div>
              <div><code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">{"{{department}}"}</code> — Department name</div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Organisation Responses</Label>
            <Button size="sm" variant="outline" onClick={() => setShowAddCanned(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Response
            </Button>
          </div>

          {showAddCanned && (
            <div className="p-4 border rounded-lg border-primary/30 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Category</Label>
                  <Input value={newCannedCategory} onChange={e => setNewCannedCategory(e.target.value)} placeholder="e.g. Greetings" list="existing-canned-categories" />
                  <datalist id="existing-canned-categories">
                    {existingCannedCategories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input value={newCannedTitle} onChange={e => setNewCannedTitle(e.target.value)} placeholder="e.g. Welcome message" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Message body</Label>
                <Textarea value={newCannedBody} onChange={e => setNewCannedBody(e.target.value)} placeholder={"Hi! I'm {{agent_name}} from {{department}}."} className="min-h-[80px]" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addCannedResponse} disabled={!newCannedTitle.trim() || !newCannedBody.trim()}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddCanned(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {cannedLoading ? (
            <div className="text-sm text-muted-foreground py-4">Loading...</div>
          ) : cannedCategories.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground border rounded-lg">No canned responses yet. Click "Add Response" to create one.</div>
          ) : (
            cannedCategories.map(cat => (
              <div key={cat} className="border rounded-lg overflow-hidden">
                <button onClick={() => toggleCategory(cat)} className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors">
                  {expandedCategories.has(cat) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{cat}</span>
                  <span className="text-xs text-muted-foreground">({cannedResponses.filter(r => r.category === cat).length})</span>
                </button>
                {expandedCategories.has(cat) && (
                  <div className="border-t">
                    {cannedResponses.filter(r => r.category === cat).map(resp => (
                      <div key={resp.id} className="p-3 border-b last:border-b-0 hover:bg-muted/30">
                        {editingCannedId === resp.id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <Input value={editCannedCategory} onChange={e => setEditCannedCategory(e.target.value)} placeholder="Category" />
                              <Input value={editCannedTitle} onChange={e => setEditCannedTitle(e.target.value)} placeholder="Title" />
                            </div>
                            <Textarea value={editCannedBody} onChange={e => setEditCannedBody(e.target.value)} className="min-h-[60px]" />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveCannedEdit(resp.id)}><Check className="h-3 w-3 mr-1" /> Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingCannedId(null)}><X className="h-3 w-3 mr-1" /> Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{resp.title}</div>
                              <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{resp.body}</div>
                            </div>
                            <div className="flex gap-1 ml-2">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                                setEditingCannedId(resp.id);
                                setEditCannedTitle(resp.title);
                                setEditCannedBody(resp.body);
                                setEditCannedCategory(resp.category);
                              }}><Edit2 className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteCannedId(resp.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteCannedId} onOpenChange={() => setDeleteCannedId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Response</AlertDialogTitle>
              <AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteCannedId && deleteCannedResponse(deleteCannedId)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </Card>
  );
}
