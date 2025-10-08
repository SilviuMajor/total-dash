import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AgentType {
  id: string;
  provider: string;
  function_name: string;
  function_type: string;
}

export function AgentTypesSection() {
  const [agentTypes, setAgentTypes] = useState<AgentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<AgentType | null>(null);
  const [formData, setFormData] = useState({
    function_name: "",
    function_type: "Voice Agent"
  });

  useEffect(() => {
    loadAgentTypes();
  }, []);

  const loadAgentTypes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('agent_types')
      .select('*')
      .order('provider');

    if (error) {
      toast.error("Failed to load agent types");
      console.error(error);
    } else {
      setAgentTypes(data || []);
    }
    setLoading(false);
  };

  const handleEdit = (type: AgentType) => {
    setEditingType(type);
    setFormData({
      function_name: type.function_name,
      function_type: type.function_type
    });
  };

  const handleSave = async () => {
    if (!editingType) return;

    const { error } = await supabase
      .from('agent_types')
      .update({
        function_name: formData.function_name,
        function_type: formData.function_type
      })
      .eq('id', editingType.id);

    if (error) {
      toast.error("Failed to update agent type");
      console.error(error);
    } else {
      toast.success("Agent type updated");
      loadAgentTypes();
      setEditingType(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Types</CardTitle>
          <CardDescription>Configure default settings for each agent provider</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Types</CardTitle>
        <CardDescription>Configure default settings for each agent provider</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          {agentTypes.map((type) => (
            <div
              key={type.id}
              className="flex-1 border rounded-lg p-4 bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold capitalize">{type.provider}</h3>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(type)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Configure {type.provider} Settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="function_name">Function Name</Label>
                        <Input
                          id="function_name"
                          value={formData.function_name}
                          onChange={(e) => setFormData({ ...formData, function_name: e.target.value })}
                          placeholder="e.g., Assistant, Support Agent"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="function_type">Function Type</Label>
                        <Select
                          value={formData.function_type}
                          onValueChange={(value) => setFormData({ ...formData, function_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Voice Agent">Voice Agent</SelectItem>
                            <SelectItem value="Text Agent">Text Agent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleSave} className="w-full">
                        Save Settings
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div><span className="font-medium">Function:</span> {type.function_name}</div>
                <div><span className="font-medium">Type:</span> {type.function_type}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
