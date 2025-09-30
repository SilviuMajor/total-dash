import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Bot, Activity, Mail, Phone, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ClientOverviewProps {
  client: {
    id: string;
    name: string;
    contact_email: string | null;
    contact_phone: string | null;
    company_address: string | null;
    subscription_status: string | null;
    is_active: boolean | null;
    created_at: string;
  };
  onUpdate: () => void;
}

export function ClientOverview({ client }: ClientOverviewProps) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    assignedAgents: 0,
    totalConversations: 0,
  });

  useEffect(() => {
    loadStats();
  }, [client.id]);

  const loadStats = async () => {
    try {
      const [usersResult, agentsResult, conversationsResult] = await Promise.all([
        supabase.from('client_users').select('id', { count: 'exact', head: true }).eq('client_id', client.id),
        supabase.from('agent_assignments').select('id', { count: 'exact', head: true }).eq('client_id', client.id),
        supabase.from('conversations').select('id', { count: 'exact', head: true })
          .in('agent_id', 
            (await supabase.from('agent_assignments').select('agent_id').eq('client_id', client.id))
              .data?.map(a => a.agent_id) || []
          ),
      ]);

      setStats({
        totalUsers: usersResult.count || 0,
        assignedAgents: agentsResult.count || 0,
        totalConversations: conversationsResult.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 bg-gradient-card border-border/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalUsers}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card border-border/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assigned Agents</p>
              <p className="text-2xl font-bold text-foreground">{stats.assignedAgents}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card border-border/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Conversations</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalConversations}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h3 className="text-lg font-semibold text-foreground mb-4">Client Information</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={client.is_active ? "default" : "secondary"}>
              {client.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between py-3 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Subscription</span>
            <Badge variant="outline">
              {client.subscription_status || "Basic"}
            </Badge>
          </div>

          {client.contact_email && (
            <div className="flex items-center gap-3 py-3 border-b border-border/50">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{client.contact_email}</span>
            </div>
          )}

          {client.contact_phone && (
            <div className="flex items-center gap-3 py-3 border-b border-border/50">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{client.contact_phone}</span>
            </div>
          )}

          {client.company_address && (
            <div className="flex items-center gap-3 py-3 border-b border-border/50">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{client.company_address}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">Created</span>
            <span className="text-sm text-foreground">
              {new Date(client.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
