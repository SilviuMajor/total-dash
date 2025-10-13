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
import { MessageBubble } from "@/components/MessageBubble";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  caller_phone: string;
  status: string;
  started_at: string;
  duration: number;
  is_widget_test?: boolean;
  metadata?: {
    variables?: {
      user_name?: string;
      user_email?: string;
      [key: string]: any;
    };
  };
}

interface Transcript {
  id: string;
  speaker: 'user' | 'assistant';
  text?: string;
  buttons?: Array<{ text: string; payload: any }>;
  timestamp: string;
  metadata?: {
    button_click?: boolean;
    [key: string]: any;
  };
}

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [agentConfig, setAgentConfig] = useState<any>(null);
  const { selectedAgentId, agents } = useClientAgentContext();

  useEffect(() => {
    if (selectedAgentId) {
      loadAgentConfig();
      loadConversations();
    }
  }, [selectedAgentId]);

  const loadAgentConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('config')
        .eq('id', selectedAgentId!)
        .single();
      
      if (error) throw error;
      setAgentConfig(data?.config || {});
    } catch (error) {
      console.error('Error loading agent config:', error);
    }
  };

  useEffect(() => {
    if (selectedConversation?.id) {
      loadTranscripts(selectedConversation.id);
    }
  }, [selectedConversation]);

  // Real-time subscriptions for conversations
  useEffect(() => {
    if (!selectedAgentId) return;
    
    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `agent_id=eq.${selectedAgentId}`
        },
        (payload) => {
          console.log('Conversation change:', payload);
          
          if (payload.eventType === 'INSERT') {
            loadConversations();
          } else if (payload.eventType === 'UPDATE') {
            setConversations(prev => 
              prev.map(c => 
                c.id === payload.new.id ? payload.new as Conversation : c
              )
            );
            
            if (selectedConversation?.id === payload.new.id) {
              setSelectedConversation(payload.new as Conversation);
            }
          }
        }
      )
      .subscribe();
    
    return () => {
      channel.unsubscribe();
    };
  }, [selectedAgentId]);

  // Real-time subscriptions for transcripts
  useEffect(() => {
    if (!selectedConversation?.id) return;
    
    const transcriptChannel = supabase
      .channel('transcripts-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transcripts',
          filter: `conversation_id=eq.${selectedConversation.id}`
        },
        (payload) => {
          console.log('New transcript:', payload);
          setTranscripts(prev => [...prev, payload.new as Transcript]);
          
          setTimeout(() => {
            const scrollArea = document.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollArea) {
              scrollArea.scrollTop = scrollArea.scrollHeight;
            }
          }, 100);
        }
      )
      .subscribe();
    
    return () => {
      transcriptChannel.unsubscribe();
    };
  }, [selectedConversation?.id]);

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('agent_id', selectedAgentId!)
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setConversations((data || []) as Conversation[]);
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
        .select('id, speaker, text, buttons, timestamp, metadata')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      setTranscripts((data || []) as Transcript[]);
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

  const filteredConversations = conversations.filter(c => {
    const searchLower = searchQuery.toLowerCase();
    return (
      c.caller_phone?.toLowerCase().includes(searchLower) ||
      c.metadata?.variables?.user_name?.toLowerCase().includes(searchLower) ||
      c.metadata?.variables?.user_email?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground">Conversations</h1>
        <p className="text-muted-foreground">Monitor and review conversations with your AI agent.</p>
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
                      <p className="font-medium text-sm">
                        {conv.metadata?.variables?.user_name || conv.caller_phone || 'Unknown'}
                      </p>
                      {conv.is_widget_test && (
                        <Badge variant="outline" className="text-xs">
                          🧪 Test
                        </Badge>
                      )}
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
                <h3 className="font-semibold text-lg">
                  {selectedConversation.metadata?.variables?.user_name || selectedConversation.caller_phone || 'Unknown'}
                </h3>
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
                    {transcripts.map((t, index) => {
                      const selectedButton = t.metadata?.button_click 
                        ? t.text 
                        : undefined;
                      
                      const prevMessage = index > 0 ? transcripts[index - 1] : null;
                      const buttonsToDisplay = t.speaker === 'user' && selectedButton && prevMessage?.buttons
                        ? prevMessage.buttons
                        : t.buttons;
                      
                      return (
                        <MessageBubble
                          key={t.id}
                          speaker={t.speaker}
                          text={t.text}
                          buttons={buttonsToDisplay}
                          timestamp={t.timestamp}
                          appearance={{
                            primaryColor: agentConfig?.widget_settings?.appearance?.primary_color || '#000000',
                            secondaryColor: agentConfig?.widget_settings?.appearance?.secondary_color || '#ffffff',
                            textColor: agentConfig?.widget_settings?.appearance?.text_color || '#000000',
                            chatIconUrl: agentConfig?.widget_settings?.appearance?.chat_icon_url,
                            messageTextColor: agentConfig?.widget_settings?.functions?.message_text_color,
                            messageBgColor: agentConfig?.widget_settings?.functions?.message_background_color,
                            fontSize: agentConfig?.widget_settings?.appearance?.font_size || 14,
                            messageBubbleStyle: agentConfig?.widget_settings?.appearance?.message_bubble_style || 'rounded',
                            interactiveButtonStyle: agentConfig?.widget_settings?.appearance?.interactive_button_style || 'solid'
                          }}
                          selectedButton={selectedButton}
                          isWidget={false}
                        />
                      );
                    })}
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
              {selectedConversation?.metadata?.variables && 
               Object.keys(selectedConversation.metadata.variables).length > 0 && (
                <div>
                  <Label className="mb-3 block font-semibold">Captured Information</Label>
                  
                  {/* Standard Variables */}
                  <div className="space-y-2 p-3 bg-muted rounded-lg mb-3">
                    <div className="text-xs font-medium text-muted-foreground uppercase mb-2">
                      Customer Details
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Name:</span>
                        <span className={`font-medium ${!selectedConversation.metadata.variables.user_name ? 'text-muted-foreground italic' : ''}`}>
                          {selectedConversation.metadata.variables.user_name || 'Not captured yet'}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Email:</span>
                        <span className={`font-medium ${!selectedConversation.metadata.variables.user_email ? 'text-muted-foreground italic' : ''}`}>
                          {selectedConversation.metadata.variables.user_email || 'Not captured yet'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Custom Variables */}
                  {agentConfig?.custom_tracked_variables?.length > 0 && (
                    <div className="space-y-2 p-3 bg-muted rounded-lg">
                      <div className="text-xs font-medium text-muted-foreground uppercase mb-2">
                        Custom Fields
                      </div>
                      
                      <div className="space-y-2">
                        {agentConfig.custom_tracked_variables.map((varName: string) => (
                          <div key={varName} className="flex justify-between text-sm">
                            <span className="text-muted-foreground capitalize">
                              {varName.replace(/_/g, ' ')}:
                            </span>
                            <span className={`font-medium ${!selectedConversation.metadata?.variables?.[varName] ? 'text-muted-foreground italic' : ''}`}>
                              {selectedConversation.metadata?.variables?.[varName] || 'Not captured yet'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                </div>
              )}
              
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
