import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  agent: { id: string; name: string; config: Record<string, any> };
  onUpdate: () => void;
}

export function VoiceflowConversationSettings({ agent, onUpdate }: Props) {
  const { toast } = useToast();
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

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('update_agent_config', {
        p_agent_id: agent.id,
        p_config_updates: {
          auto_end_hours: autoEndHours,
          auto_end_mode: autoEndMode,
          response_thresholds: { green_seconds: greenSeconds, amber_seconds: amberSeconds },
          resolution_reasons: resolutionReasons,
        },
      });
      if (error) throw error;
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

        <div className="space-y-4 p-4 border rounded-lg">
          <div>
            <Label className="text-sm font-medium">Response Time Indicators</Label>
            <p className="text-xs text-muted-foreground">Colour thresholds for the waiting time indicator on conversation cards</p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">🟢 Green until (seconds)</Label>
              <Input type="number" min={10} value={greenSeconds} onChange={(e) => setGreenSeconds(Math.max(10, parseInt(e.target.value) || 10))} className="w-28" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">🟠 Amber until (seconds)</Label>
              <Input type="number" min={30} value={amberSeconds} onChange={(e) => setAmberSeconds(Math.max(30, parseInt(e.target.value) || 30))} className="w-28" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">🔴 Red after</Label>
            </div>
          </div>
        </div>

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

        <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save Settings"}</Button>
      </div>
    </Card>
  );
}
