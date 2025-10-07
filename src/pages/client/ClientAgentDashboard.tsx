import { useEffect, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { Phone, Clock, CheckCircle, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { ClientAgentSelector } from "@/components/ClientAgentSelector";
import { NoAgentsAssigned } from "@/components/NoAgentsAssigned";

interface Conversation {
  id: string;
  caller_phone: string;
  status: string;
  started_at: string;
  duration: number;
}

export default function ClientAgentDashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyLogoUrl, setAgencyLogoUrl] = useState<string | null>(null);
  const { selectedAgentId, agents, clientId } = useClientAgentContext();

  useEffect(() => {
    if (selectedAgentId) {
      loadConversations();
    }
  }, [selectedAgentId]);

  useEffect(() => {
    loadAgencyLogo();
  }, []);

  const loadAgencyLogo = async () => {
    const { data } = await supabase
      .from('agency_settings')
      .select('agency_logo_url')
      .single();
    
    if (data?.agency_logo_url) {
      setAgencyLogoUrl(data.agency_logo_url);
    }
  };

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('agent_id', selectedAgentId!)
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (agents.length === 0) {
    return <NoAgentsAssigned />;
  }

  const stats = {
    totalCalls: conversations.length,
    avgDuration: conversations.length > 0 
      ? Math.round(conversations.reduce((sum, c) => sum + (c.duration || 0), 0) / conversations.length / 60)
      : 0,
    activeNow: conversations.filter(c => c.status === 'active').length,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Conversations</h1>
          <p className="text-muted-foreground">Monitor live and recent conversations with your AI agent.</p>
        </div>
        <div className="flex items-center gap-4">
          <ClientAgentSelector />
          {agencyLogoUrl && (
            <img 
              src={agencyLogoUrl} 
              alt="Agency logo" 
              className="w-16 h-16 object-contain"
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Conversations"
          value={stats.totalCalls}
          icon={Phone}
          trend="neutral"
        />
        <MetricCard
          title="Avg Duration"
          value={`${stats.avgDuration}m`}
          icon={Clock}
          trend="neutral"
        />
        <MetricCard
          title="Active Now"
          value={stats.activeNow}
          icon={MessageSquare}
          trend="neutral"
        />
        <MetricCard
          title="Completed"
          value={conversations.filter(c => c.status === 'completed').length}
          icon={CheckCircle}
          trend="neutral"
        />
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h3 className="text-lg font-semibold text-foreground mb-4">Recent Conversations</h3>
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No conversations yet for this agent.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {conversations.map((conversation) => (
              <div key={conversation.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className={`w-2 h-2 rounded-full ${
                  conversation.status === "active" ? "bg-success animate-pulse" :
                  conversation.status === "completed" ? "bg-muted-foreground" :
                  "bg-warning"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{conversation.caller_phone || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(conversation.started_at).toLocaleString()}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-muted capitalize">
                  {conversation.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}