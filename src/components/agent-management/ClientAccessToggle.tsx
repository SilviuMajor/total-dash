import { useState } from "react";
import { Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ClientAccessToggleProps {
  agent: {
    id: string;
    config: Record<string, any>;
  };
  configKey: string;
  label: string;
  description: string;
  onUpdate: () => void;
}

export function ClientAccessToggle({ 
  agent, 
  configKey, 
  label, 
  description,
  onUpdate 
}: ClientAccessToggleProps) {
  const { toast } = useToast();
  const [isEnabled, setIsEnabled] = useState(
    agent.config?.[configKey] === true
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setIsSaving(true);
    try {
      const updatedConfig = {
        ...agent.config,
        [configKey]: checked,
      };

      const { error } = await supabase
        .from("agents")
        .update({ config: updatedConfig })
        .eq("id", agent.id);

      if (error) throw error;

      setIsEnabled(checked);
      onUpdate();
      
      toast({
        title: checked ? "Enabled for clients" : "Disabled for clients",
        description: `${label} is now ${checked ? "visible" : "hidden"} for clients.`,
      });
    } catch (error) {
      console.error("Error updating client access:", error);
      toast({
        title: "Error",
        description: "Failed to update client access setting",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 mb-4 border border-dashed border-muted-foreground/30 rounded-lg bg-muted/30">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-primary/10">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <div>
          <Label htmlFor={`client-access-${configKey}`} className="text-sm font-medium">
            {label}
          </Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        id={`client-access-${configKey}`}
        checked={isEnabled}
        onCheckedChange={handleToggle}
        disabled={isSaving}
      />
    </div>
  );
}
