import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Pencil, Trash2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { numberInputProps, clampForSave } from "@/lib/numberInput";

interface Props {
  agent: { id: string; name: string; config: Record<string, any> };
  onUpdate: () => void;
}

const TAGS_PER_PAGE = 5;

export function VoiceflowConversationSettings({ agent, onUpdate }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [autoEndHours, setAutoEndHours] = useState(agent.config?.auto_end_hours || 12);
  const [autoEndMode, setAutoEndMode] = useState<'since_start' | 'since_last_message'>(agent.config?.auto_end_mode || 'since_last_message');
  const [greenSeconds, setGreenSeconds] = useState(agent.config?.response_thresholds?.green_seconds || 60);
  const [amberSeconds, setAmberSeconds] = useState(agent.config?.response_thresholds?.amber_seconds || 300);
  const [resolutionReasons, setResolutionReasons] = useState<Array<{ id: string; label: string; note_required: boolean }>>(
    agent.config?.resolution_reasons || []
  );
  const [newReasonLabel, setNewReasonLabel] = useState('');
  const [newReasonNoteRequired, setNewReasonNoteRequired] = useState(false);

  // Force-pinned filter rows (admin lock — applies to all users on this agent)
  const initialForcePinned = agent.config?.force_pinned_filter_rows || {};
  const [forcePinStatus, setForcePinStatus] = useState<boolean>(initialForcePinned.status === true);
  const [forcePinDepartment, setForcePinDepartment] = useState<boolean>(initialForcePinned.department === true);
  const [forcePinTags, setForcePinTags] = useState<boolean>(initialForcePinned.tags === true);

  // Tags state
  const initialTags: Array<{ id: string; label: string }> = (
    agent.config?.conversation_tags ||
    agent.config?.widget_settings?.functions?.conversation_tags?.map((t: any) => ({ id: t.id, label: t.label })) ||
    []
  );
  const [tags, setTags] = useState<Array<{ id: string; label: string }>>(initialTags);
  const [tagsEnabled, setTagsEnabled] = useState<boolean>(agent.config?.tags_enabled ?? true);
  const [allowAdhocTags, setAllowAdhocTags] = useState(agent.config?.allow_adhoc_tags ?? false);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagLabel, setEditingTagLabel] = useState('');
  const [tagPage, setTagPage] = useState(0);
  const [tagUsageCounts, setTagUsageCounts] = useState<Record<string, number>>({});

  // Load tag usage counts
  useEffect(() => {
    const loadTagCounts = async () => {
      if (!agent.id) return;
      const { data } = await supabase
        .from('conversations')
        .select('metadata')
        .eq('agent_id', agent.id)
        .not('metadata', 'is', null);
      if (!data) return;
      const counts: Record<string, number> = {};
      data.forEach((conv: any) => {
        const convTags = conv.metadata?.tags;
        if (Array.isArray(convTags)) {
          convTags.forEach((t: string) => {
            counts[t] = (counts[t] || 0) + 1;
          });
        }
      });
      setTagUsageCounts(counts);
    };
    loadTagCounts();
  }, [agent.id]);

  const totalTagPages = Math.ceil(tags.length / TAGS_PER_PAGE);
  const pagedTags = tags.slice(tagPage * TAGS_PER_PAGE, (tagPage + 1) * TAGS_PER_PAGE);

  const addTag = () => {
    const label = newTagLabel.trim();
    if (!label) return;
    if (tags.some(t => t.label.toLowerCase() === label.toLowerCase())) {
      toast({ title: "Tag already exists", variant: "destructive" });
      return;
    }
    setTags(prev => [...prev, { id: crypto.randomUUID(), label }]);
    setNewTagLabel('');
    const newTotal = Math.ceil((tags.length + 1) / TAGS_PER_PAGE);
    setTagPage(newTotal - 1);
  };

  const deleteTag = (id: string) => {
    setTags(prev => prev.filter(t => t.id !== id));
    const remaining = tags.length - 1;
    const maxPage = Math.max(0, Math.ceil(remaining / TAGS_PER_PAGE) - 1);
    if (tagPage > maxPage) setTagPage(maxPage);
  };

  const startEditTag = (tag: { id: string; label: string }) => {
    setEditingTagId(tag.id);
    setEditingTagLabel(tag.label);
  };

  const saveEditTag = () => {
    const label = editingTagLabel.trim();
    if (!label || !editingTagId) return;
    if (tags.some(t => t.id !== editingTagId && t.label.toLowerCase() === label.toLowerCase())) {
      toast({ title: "Tag name already exists", variant: "destructive" });
      return;
    }
    setTags(prev => prev.map(t => t.id === editingTagId ? { ...t, label } : t));
    setEditingTagId(null);
    setEditingTagLabel('');
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('update_agent_config', {
        p_agent_id: agent.id,
        p_config_updates: {
          auto_end_hours: autoEndHours,
          auto_end_mode: autoEndMode,
          response_thresholds: { green_seconds: clampForSave(greenSeconds, 10, 60), amber_seconds: clampForSave(amberSeconds, 30, 300) },
          resolution_reasons: resolutionReasons,
          conversation_tags: tags,
          allow_adhoc_tags: allowAdhocTags,
          tags_enabled: tagsEnabled,
          force_pinned_filter_rows: {
            status: forcePinStatus,
            department: forcePinDepartment,
            tags: forcePinTags,
          },
        },
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['agent-config', agent.id] });
      toast({ title: "Success", description: "Conversation settings saved" });
      onUpdate();
    } catch (e) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Card>
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Conversation Settings</h2>
          <p className="text-sm text-muted-foreground">Configure how conversations are managed for this agent.</p>
        </div>

        {/* Auto-End section */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div>
            <Label className="text-sm font-medium">Conversation Auto-End</Label>
            <p className="text-xs text-muted-foreground">Automatically end conversations and create transcripts</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Auto-end based on</Label>
            <RadioGroup value={autoEndMode} onValueChange={(v) => setAutoEndMode(v as any)} className="flex flex-col gap-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="since_last_message" id="conv_last_msg" />
                <Label htmlFor="conv_last_msg" className="font-normal cursor-pointer text-sm">Since last message (inactivity)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="since_start" id="conv_start" />
                <Label htmlFor="conv_start" className="font-normal cursor-pointer text-sm">Since conversation start</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Auto-end after</Label>
            <Select value={autoEndHours.toString()} onValueChange={(v) => setAutoEndHours(parseInt(v))}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1,2,4,6,8,12,18,24].map(h => <SelectItem key={h} value={h.toString()}>{h} hour{h !== 1 ? 's' : ''}{h === 12 ? ' (default)' : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Response Time Indicators section */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div>
            <Label className="text-sm font-medium">Response Time Indicators</Label>
            <p className="text-xs text-muted-foreground">Colour thresholds for the waiting time indicator on conversation cards</p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">🟢 Green until (seconds)</Label>
              <Input type="number" min={10} className="w-28" {...numberInputProps({ value: greenSeconds, setValue: setGreenSeconds, min: 10 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">🟠 Amber until (seconds)</Label>
              <Input type="number" min={30} className="w-28" {...numberInputProps({ value: amberSeconds, setValue: setAmberSeconds, min: 30 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">🔴 Red after</Label>
            </div>
          </div>
        </div>

        {/* Resolution Reasons section */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div>
            <Label className="text-sm font-medium">Resolution Reasons</Label>
            <p className="text-xs text-muted-foreground">
              When agents resolve a conversation, they'll be asked to select one of these reasons. Leave empty to allow resolving without a reason.
            </p>
          </div>

          {resolutionReasons.length > 0 && (
            <div className="space-y-2">
              {resolutionReasons.map((reason) => (
                <div key={reason.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/30">
                  <span className="text-sm">{reason.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {reason.note_required ? 'Note required' : 'Note optional'}
                    </span>
                    <button
                      onClick={() => setResolutionReasons(prev => prev.filter(r => r.id !== reason.id))}
                      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Input
              value={newReasonLabel}
              onChange={(e) => setNewReasonLabel(e.target.value)}
              placeholder="Add new reason..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newReasonLabel.trim()) {
                  setResolutionReasons(prev => [...prev, { id: crypto.randomUUID(), label: newReasonLabel.trim(), note_required: newReasonNoteRequired }]);
                  setNewReasonLabel('');
                  setNewReasonNoteRequired(false);
                }
              }}
            />
            <Label htmlFor="new-reason-note" className="text-xs text-muted-foreground whitespace-nowrap cursor-pointer">Require note</Label>
            <Switch id="new-reason-note" checked={newReasonNoteRequired} onCheckedChange={setNewReasonNoteRequired} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (newReasonLabel.trim()) {
                  setResolutionReasons(prev => [...prev, { id: crypto.randomUUID(), label: newReasonLabel.trim(), note_required: newReasonNoteRequired }]);
                  setNewReasonLabel('');
                  setNewReasonNoteRequired(false);
                }
              }}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Tags section */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Tags</Label>
              <p className="text-xs text-muted-foreground">
                Pre-defined tags agents can apply to conversations. Deleting a tag removes it from future use but preserves it on existing conversations.
              </p>
            </div>
            <Switch checked={tagsEnabled} onCheckedChange={setTagsEnabled} />
          </div>

          <div className={tagsEnabled ? "space-y-4" : "space-y-4 opacity-50 pointer-events-none"}>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Allow on-the-fly tag creation</Label>
              <p className="text-xs text-muted-foreground">Let agents create new tags directly from conversations</p>
            </div>
            <Switch checked={allowAdhocTags} onCheckedChange={setAllowAdhocTags} disabled={!tagsEnabled} />
          </div>

          {tags.length > 0 && (
            <div className="space-y-2">
              {pagedTags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/30">
                  {editingTagId === tag.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingTagLabel}
                        onChange={(e) => setEditingTagLabel(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditTag();
                          if (e.key === 'Escape') { setEditingTagId(null); setEditingTagLabel(''); }
                        }}
                      />
                      <button onClick={saveEditTag} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setEditingTagId(null); setEditingTagLabel(''); }} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col">
                        <span className="text-sm">{tag.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {tagUsageCounts[tag.label] ? `Used ${tagUsageCounts[tag.label]} time${tagUsageCounts[tag.label] !== 1 ? 's' : ''}` : 'Not used'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEditTag(tag)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteTag(tag.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {totalTagPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing {tagPage * TAGS_PER_PAGE + 1}–{Math.min((tagPage + 1) * TAGS_PER_PAGE, tags.length)} of {tags.length} tags
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" disabled={tagPage === 0} onClick={() => setTagPage(p => p - 1)}>Prev</Button>
                <Button variant="ghost" size="sm" disabled={tagPage >= totalTagPages - 1} onClick={() => setTagPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Input
              value={newTagLabel}
              onChange={(e) => setNewTagLabel(e.target.value)}
              placeholder="Add new tag..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTag();
              }}
            />
            <Button variant="outline" size="sm" onClick={addTag}>Add</Button>
          </div>

          </div>
        </div>

        {/* Force pinned filter rows section */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div>
            <Label className="text-sm font-medium">Force pinned filter rows</Label>
            <p className="text-xs text-muted-foreground">
              Lock these rows visible for all users on the Conversations page. They won't be able to hide them.
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="force-pin-status" className="flex items-center gap-2 cursor-pointer">
              <Checkbox id="force-pin-status" checked={forcePinStatus} onCheckedChange={(v) => setForcePinStatus(v === true)} />
              <span className="text-sm">Status</span>
            </label>
            <label htmlFor="force-pin-department" className="flex items-center gap-2 cursor-pointer">
              <Checkbox id="force-pin-department" checked={forcePinDepartment} onCheckedChange={(v) => setForcePinDepartment(v === true)} />
              <span className="text-sm">Department</span>
            </label>
            <label htmlFor="force-pin-tags" className="flex items-center gap-2 cursor-pointer">
              <Checkbox id="force-pin-tags" checked={forcePinTags} onCheckedChange={(v) => setForcePinTags(v === true)} />
              <span className="text-sm">Tags</span>
            </label>
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save Settings"}</Button>
      </div>
    </Card>
  );
}
