import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  agent: { id: string; name: string; config: Record<string, any> };
  onUpdate: () => void;
}

export function VoiceflowHandoverSettings({ agent, onUpdate }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const inactivity = agent.config?.handover_inactivity || {};
  const [nudgeEnabled, setNudgeEnabled] = useState(inactivity.nudge_enabled !== false);
  const [nudgeDelay, setNudgeDelay] = useState(inactivity.nudge_delay_minutes || 5);
  const [nudgeMessage, setNudgeMessage] = useState(inactivity.nudge_message || "Are you still there? Let us know if you need anything else.");
  const [nudgeRepeat, setNudgeRepeat] = useState<'once' | 'repeat'>(inactivity.nudge_repeat || 'once');
  const [nudgeInterval, setNudgeInterval] = useState(inactivity.nudge_repeat_interval_minutes || 5);
  const [hardEnabled, setHardEnabled] = useState(inactivity.hard_timeout_enabled !== false);
  const [hardMinutes, setHardMinutes] = useState(inactivity.hard_timeout_minutes || 20);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('update_agent_config', {
        p_agent_id: agent.id,
        p_config_updates: {
          handover_inactivity: {
            nudge_enabled: nudgeEnabled,
            nudge_delay_minutes: nudgeDelay,
            nudge_message: nudgeMessage,
            nudge_repeat: nudgeRepeat,
            nudge_repeat_interval_minutes: nudgeInterval,
            hard_timeout_enabled: hardEnabled,
            hard_timeout_minutes: hardMinutes,
          },
        },
      });
      if (error) throw error;
      toast({ title: "Success", description: "Handover settings saved" });
      onUpdate();
    } catch (e) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Card>
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Handover Settings</h2>
          <p className="text-sm text-muted-foreground">Configure customer inactivity behaviour during live handovers.</p>
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
            <div className="space-y-3 pl-1 border-l-2 border-primary/20 ml-1 pl-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Send after (minutes)</Label>
                <Input type="number" min={1} max={60} value={nudgeDelay} onChange={(e) => setNudgeDelay(Math.max(1, parseInt(e.target.value) || 1))} className="w-32" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Nudge message</Label>
                <Textarea value={nudgeMessage} onChange={(e) => setNudgeMessage(e.target.value)} className="min-h-[60px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Repeat behaviour</Label>
                <RadioGroup value={nudgeRepeat} onValueChange={(v) => setNudgeRepeat(v as any)} className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="once" id="ho_once" />
                    <Label htmlFor="ho_once" className="font-normal cursor-pointer text-sm">Send once</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="repeat" id="ho_repeat" />
                    <Label htmlFor="ho_repeat" className="font-normal cursor-pointer text-sm">Repeat until customer responds</Label>
                  </div>
                </RadioGroup>
              </div>
              {nudgeRepeat === 'repeat' && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Repeat interval (minutes)</Label>
                  <Input type="number" min={1} max={60} value={nudgeInterval} onChange={(e) => setNudgeInterval(Math.max(1, parseInt(e.target.value) || 1))} className="w-32" />
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
            <Switch checked={hardEnabled} onCheckedChange={setHardEnabled} />
          </div>
          {hardEnabled && (
            <div className="space-y-1.5">
              <Label className="text-sm">End handover after (minutes)</Label>
              <Input type="number" min={5} max={120} value={hardMinutes} onChange={(e) => setHardMinutes(Math.max(5, parseInt(e.target.value) || 5))} className="w-32" />
              <p className="text-xs text-muted-foreground">Handover ends after {hardMinutes} minutes of customer inactivity.</p>
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save Settings"}</Button>
      </div>
    </Card>
  );
}
