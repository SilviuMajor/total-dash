import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Building2, Activity } from "lucide-react";
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

export function AgentDetailHeader({ agent, assignedClients, onUpdate }: AgentDetailHeaderProps) {
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
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{agent.name}</h1>
            <Badge variant="outline" className="capitalize">
              {agent.provider}
            </Badge>
            <Badge className={getStatusColor(agent.status)}>
              <Activity className="w-3 h-3 mr-1" />
              {getStatusLabel(agent.status)}
            </Badge>
          </div>
          {assignedClients.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Assigned to: {assignedClients.map(c => c.name).join(', ')}
            </p>
          )}
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Select value={agent.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="testing">Testing</SelectItem>
                <SelectItem value="in_development">In Development</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
