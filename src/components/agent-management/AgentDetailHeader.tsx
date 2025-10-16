import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface Agent {
  id: string;
  name: string;
  provider: string;
  status: 'active' | 'testing' | 'in_development';
}

interface AssignedClient {
  id: string;
  name: string;
}

interface AgentDetailHeaderProps {
  agent: Agent;
  assignedClients: AssignedClient[];
  onUpdate: () => void;
  onBack: () => void;
  description?: string;
}

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

export function AgentDetailHeader({ agent, assignedClients, onUpdate, onBack, description = "Agent Management Dashboard" }: AgentDetailHeaderProps) {
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setIsAdmin(data?.role === 'admin');
    };
    checkAdmin();
  }, []);

  const handleStatusChange = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('agents')
        .update({ status: newStatus as 'active' | 'testing' | 'in_development' })
        .eq('id', agent.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Agent status updated successfully",
      });
      onUpdate();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update agent status",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Row 1: Back Button + Agent Name + Status Dropdown */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={onBack}
            className="border-border/50"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-4xl font-bold text-foreground">{agent.name}</h1>
        </div>

        {isAdmin && (
          <Select value={agent.status} onValueChange={handleStatusChange}>
            <SelectTrigger className={`${getStatusColor(agent.status)} border-none w-auto px-4 py-2 h-auto gap-2`}>
              <Activity className="w-3 h-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="testing">Testing</SelectItem>
              <SelectItem value="in_development">In Development</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Row 2: Subtitle + Provider Badge + Assigned Clients */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">{description}</p>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="capitalize">
            {agent.provider}
          </Badge>
          {assignedClients.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Assigned to: {assignedClients.map(c => c.name).join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
