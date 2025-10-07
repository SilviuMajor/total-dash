import { useEffect, useState } from "react";
import { Phone, Clock, CheckCircle, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { NoAgentsAssigned } from "@/components/NoAgentsAssigned";
import { MetricCard } from "@/components/MetricCard";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  caller_phone: string;
  status: string;
  started_at: string;
  duration: number;
}

interface Transcript {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { selectedAgentId, agents } = useClientAgentContext();

  useEffect(() => {
    if (selectedAgentId) {
      loadConversations();
    }
  }, [selectedAgentId]);

  useEffect(() => {
    if (selectedConversation) {
      loadTranscripts(selectedConversation.id);
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('agent_id', selectedAgentId!)
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTranscripts = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('transcripts')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      setTranscripts(data || []);
    } catch (error) {
      console.error('Error loading transcripts:', error);
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

  const filteredConversations = conversations.filter(c => 
    c.caller_phone?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground">Conversations</h1>
        <p className="text-muted-foreground">Monitor and review conversations with your AI agent.</p>
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

      <div className="flex h-[600px] gap-4 border border-border rounded-lg overflow-hidden bg-card">
        {/* Left Panel: Conversation List */}
        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <Input 
              placeholder="Search conversations..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-2 p-2">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse p-3 rounded-lg bg-muted"></div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No conversations found.
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      "p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors",
                      selectedConversation?.id === conv.id && "bg-muted"
                    )}
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{conv.caller_phone || 'Unknown'}</p>
                      <Badge variant={conv.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {conv.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conv.started_at))} ago
                    </p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Middle Panel: Transcript */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-lg">{selectedConversation.caller_phone}</h3>
                <p className="text-sm text-muted-foreground">
                  Started {format(new Date(selectedConversation.started_at), 'PPp')}
                </p>
              </div>
              <ScrollArea className="flex-1 p-4">
                {transcripts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No transcript available for this conversation.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {transcripts.map((t) => (
                      <div key={t.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">{t.speaker}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(t.timestamp), 'HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm">{t.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a conversation to view details
            </div>
          )}
        </div>

        {/* Right Panel: Details */}
        <div className="w-80 border-l border-border p-4 space-y-4 overflow-y-auto">
          {selectedConversation ? (
            <>
              <div>
                <Label className="mb-2 block">Actions</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1">Export</Button>
                  <Button size="sm" variant="outline" className="flex-1">Delete</Button>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="intent-confidence">Intent Confidence</Label>
                  <Switch id="intent-confidence" />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="debug-messages">Debug Messages</Label>
                  <Switch id="debug-messages" />
                </div>
              </div>
              
              <div>
                <Label htmlFor="note" className="mb-2 block">Note</Label>
                <Textarea 
                  id="note"
                  placeholder="Add a note about this conversation..."
                  className="min-h-[100px]"
                />
                <Button size="sm" className="mt-2 w-full">Save Note</Button>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground text-sm">
              Select a conversation to view options
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
