import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Bot, Activity, Copy, Loader2, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Agent {
  id: string;
  name: string;
  provider: string;
  created_at: string;
  status: 'active' | 'testing' | 'in_development';
}

export default function AdminAgents() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [providerFilter, setProviderFilter] = useState<string>("voiceflow");
  const [formData, setFormData] = useState({
    name: "",
    provider: "voiceflow",
    api_key: "",
  });
  const [duplicating, setDuplicating] = useState(false);
  const [agentToDuplicate, setAgentToDuplicate] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('id, name, provider, created_at, status')
        .order('name');

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'testing':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'in_development':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'testing':
        return 'Testing';
      case 'in_development':
        return 'In Development';
      default:
        return status;
    }
  };

  const filteredAgents = agents.filter(
    (agent) => agent.provider === providerFilter
  );

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('agents')
        .insert([formData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Agent created successfully",
      });

      setFormData({ name: "", provider: "voiceflow", api_key: "" });
      setOpen(false);
      loadAgents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDuplicateClick = async (e: React.MouseEvent, agentId: string) => {
    e.stopPropagation();
    setAgentToDuplicate(agentId);
    setDuplicating(true);

    try {
      const { data, error } = await supabase.functions.invoke('duplicate-agent', {
        body: { agentId }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Agent duplicated successfully as "${data.newAgentName}"`,
      });

      loadAgents(); // Refresh list
    } catch (error: any) {
      console.error('Duplication error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate agent",
        variant: "destructive",
      });
    } finally {
      setDuplicating(false);
      setAgentToDuplicate(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Agent Management</h1>
          <p className="text-muted-foreground">Create and manage AI agents with API integrations.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-foreground text-background hover:bg-foreground/90 gap-2">
              <Plus className="w-4 h-4" />
              New Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateAgent} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Agent Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Sales Agent Pro"
                  required
                  className="bg-muted/50 border-border"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select value={formData.provider} onValueChange={(value) => setFormData({ ...formData, provider: value })}>
                  <SelectTrigger className="bg-muted/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="voiceflow">Voiceflow</SelectItem>
                    <SelectItem value="retell">Retell AI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_key">API Key</Label>
                <Input
                  id="api_key"
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder="Enter API key"
                  required
                  className="bg-muted/50 border-border"
                />
              </div>

              <Button type="submit" className="w-full bg-foreground text-background hover:bg-foreground/90">
                Create Agent
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-1.5 mb-6">
        <Button
          variant={providerFilter === 'voiceflow' ? 'default' : 'outline'}
          onClick={() => setProviderFilter('voiceflow')}
          className={providerFilter === 'voiceflow' ? 'bg-foreground text-background px-3 py-2 text-sm' : 'px-3 py-2 text-sm'}
        >
          Voiceflow ({agents.filter(a => a.provider === 'voiceflow').length})
        </Button>
        <Button
          variant={providerFilter === 'retell' ? 'default' : 'outline'}
          onClick={() => setProviderFilter('retell')}
          className={providerFilter === 'retell' ? 'bg-foreground text-background px-3 py-2 text-sm' : 'px-3 py-2 text-sm'}
        >
          Retell AI ({agents.filter(a => a.provider === 'retell').length})
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4 w-full">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-6 bg-gradient-card border-border/50 animate-pulse">
              <div className="h-24"></div>
            </Card>
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-card border-border/50">
          <p className="text-muted-foreground">No {providerFilter} agents found</p>
        </Card>
      ) : (
        <div className="space-y-4 w-full">
          {filteredAgents.map((agent) => (
            <Card 
              key={agent.id} 
              className="w-full p-4 bg-gradient-card border-border/50 hover:border-primary/50 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                {/* Agent Icon */}
                <div 
                  className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center cursor-pointer"
                  onClick={() => navigate(`/admin/agents/${agent.id}`)}
                >
                  <Bot className="w-6 h-6 text-primary" />
                </div>

                {/* Agent Info */}
                <div 
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/admin/agents/${agent.id}`)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-foreground truncate">{agent.name}</h3>
                    <Badge className={getStatusColor(agent.status)}>
                      <Activity className="w-3 h-3 mr-1" />
                      {getStatusLabel(agent.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground capitalize">{agent.provider}</p>
                </div>

                {/* Action Buttons */}
                  <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border/50 gap-2"
                    onClick={() => navigate(`/admin/agents/${agent.id}`)}
                  >
                    <Settings className="h-4 w-4" />
                    Manage Agent
                  </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-border/50"
                      onClick={(e) => handleDuplicateClick(e, agent.id)}
                      disabled={duplicating && agentToDuplicate === agent.id}
                    >
                      {duplicating && agentToDuplicate === agent.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
