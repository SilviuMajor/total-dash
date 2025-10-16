import { useEffect, useState } from "react";
import { Phone, Clock, CheckCircle, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { NoAgentsAssigned } from "@/components/NoAgentsAssigned";
import { ClientAgentSelector } from "@/components/ClientAgentSelector";
import { MetricCard } from "@/components/MetricCard";
import { MessageBubble } from "@/components/MessageBubble";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
    note?: string;
    tags?: string[];
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
  const [note, setNote] = useState("");
  const [assignedTags, setAssignedTags] = useState<string[]>([]);
  const [savingNote, setSavingNote] = useState(false);
  const [updatingTags, setUpdatingTags] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { selectedAgentId, agents } = useClientAgentContext();
  const { toast } = useToast();

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
      setNote(selectedConversation.metadata?.note || "");
      setAssignedTags(selectedConversation.metadata?.tags || []);
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
          
          // Only reload if it's not an update to the currently selected conversation
          // This prevents overwriting local state while user is editing
          if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            loadConversations();
          } else if (payload.eventType === 'UPDATE') {
            // For updates, only reload if it's not the selected conversation
            if (!selectedConversation || payload.new.id !== selectedConversation.id) {
              loadConversations();
            } else {
              // Update only the specific conversation in the list without reloading all
              setConversations(prev => 
                prev.map(c => c.id === payload.new.id ? payload.new as Conversation : c)
              );
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

  const saveNote = async () => {
    if (!selectedConversation) return;

    setSavingNote(true);
    try {
      const { error } = await supabase
        .from('conversations')
        .update({
          metadata: {
            ...selectedConversation.metadata,
            note: note
          }
        })
        .eq('id', selectedConversation.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Note saved successfully"
      });

      // Update selected conversation state
      setSelectedConversation(prev => prev ? {
        ...prev,
        metadata: { ...prev.metadata, note }
      } : null);

      // Update local conversations list
      setConversations(prev => 
        prev.map(c => c.id === selectedConversation.id 
          ? { ...c, metadata: { ...c.metadata, note } }
          : c
        )
      );
    } catch (error) {
      console.error('Error saving note:', error);
      toast({
        title: "Error",
        description: "Failed to save note",
        variant: "destructive"
      });
    } finally {
      setSavingNote(false);
    }
  };

  const toggleTag = async (tagLabel: string) => {
    if (!selectedConversation || updatingTags) return;

    const newTags = assignedTags.includes(tagLabel)
      ? assignedTags.filter(t => t !== tagLabel)
      : [...assignedTags, tagLabel];

    setUpdatingTags(true);
    try {
      const { error } = await supabase
        .from('conversations')
        .update({
          metadata: {
            ...selectedConversation.metadata,
            tags: newTags
          }
        })
        .eq('id', selectedConversation.id);

      if (error) throw error;

      setAssignedTags(newTags);

      // Update selected conversation state
      setSelectedConversation(prev => prev ? {
        ...prev,
        metadata: { ...prev.metadata, tags: newTags }
      } : null);

      // Update local conversations list
      setConversations(prev => 
        prev.map(c => c.id === selectedConversation.id 
          ? { ...c, metadata: { ...c.metadata, tags: newTags } }
          : c
        )
      );
    } catch (error) {
      console.error('Error toggling tag:', error);
      toast({
        title: "Error",
        description: "Failed to update tags",
        variant: "destructive"
      });
    } finally {
      setUpdatingTags(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!selectedConversation || updatingStatus) return;

    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ status: newStatus })
        .eq('id', selectedConversation.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Status updated to ${newStatus}`
      });

      // Update selected conversation state
      setSelectedConversation(prev => prev ? { ...prev, status: newStatus } : null);

      // Update local conversations list
      setConversations(prev => 
        prev.map(c => c.id === selectedConversation.id ? { ...c, status: newStatus } : c)
      );
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive"
      });
    } finally {
      setUpdatingStatus(false);
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
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">Conversations</h1>
            <p className="text-muted-foreground">
              Review and manage your agent conversations
            </p>
          </div>
          <ClientAgentSelector />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <Card className="h-full overflow-hidden">
          <div className="grid grid-cols-12 h-full">
            {/* Left Panel: Conversation List */}
            <div className="col-span-3 flex flex-col border-r border-border h-full">
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
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium text-sm">
                        {conv.metadata?.variables?.user_name || conv.caller_phone || 'Unknown'}
                      </p>
                      {conv.is_widget_test && (
                        <Badge variant="outline" className="text-xs">
                          🧪 Test
                        </Badge>
                      )}
                      <Badge 
                        variant={conv.status === 'active' ? 'default' : 'secondary'} 
                        className={cn(
                          "text-xs",
                          conv.status === 'owned' && "bg-yellow-500 text-white hover:bg-yellow-600"
                        )}
                      >
                        {conv.status === 'owned' ? 'Owned' : conv.status.charAt(0).toUpperCase() + conv.status.slice(1)}
                      </Badge>
                      {conv.metadata?.tags?.map((tag: string) => {
                        const tagConfig = agentConfig?.widget_settings?.functions?.conversation_tags?.find(
                          (t: any) => t.label === tag
                        );
                        return tagConfig ? (
                          <Badge 
                            key={tag} 
                            variant="outline" 
                            className="text-xs"
                            style={{ 
                              backgroundColor: `${tagConfig.color}20`,
                              borderColor: tagConfig.color,
                              color: tagConfig.color
                            }}
                          >
                            {tag}
                          </Badge>
                        ) : null;
                      })}
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
            <div className="col-span-6 flex flex-col border-r border-border h-full">
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
            <div className="col-span-3 p-6 flex flex-col h-full overflow-y-auto space-y-4">
          {selectedConversation ? (
            <>
              {selectedConversation?.metadata?.variables && 
               Object.keys(selectedConversation.metadata.variables).length > 0 && (
                <div>
                  <Label className="mb-3 block font-semibold">Captured Information</Label>
                  
                  {/* Unified list - standard and custom variables merged */}
                  <div className="space-y-2 p-3 bg-muted rounded-lg">
                    <div className="space-y-2">
                      {/* Standard Variables */}
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
                      
                      {/* Custom Variables - integrated into same list */}
                      {agentConfig?.custom_tracked_variables?.map((variable: any) => {
                        // Handle both old format (string) and new format (object)
                        const voiceflowName = typeof variable === 'string' ? variable : variable.voiceflow_name;
                        const displayName = typeof variable === 'string' 
                          ? variable.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                          : variable.display_name;
                          
                        return (
                          <div key={voiceflowName} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {displayName}:
                            </span>
                            <span className={`font-medium ${!selectedConversation.metadata?.variables?.[voiceflowName] ? 'text-muted-foreground italic' : ''}`}>
                              {selectedConversation.metadata?.variables?.[voiceflowName] || 'Not captured yet'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Status Dropdown */}
              <div>
                <Label className="mb-2 block">Status</Label>
                <Select
                  value={selectedConversation?.status || 'active'}
                  onValueChange={updateStatus}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span>Active</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="owned">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span>Owned</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="resolved">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>Resolved</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tags Section */}
              <div>
                <Label className="mb-2 block">Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {agentConfig?.widget_settings?.functions?.conversation_tags
                    ?.filter((tag: any) => tag.enabled)
                    .map((tag: any) => {
                      const isAssigned = assignedTags.includes(tag.label);
                      return (
                        <Button
                          key={tag.id}
                          size="sm"
                          variant={isAssigned ? "default" : "outline"}
                          onClick={() => toggleTag(tag.label)}
                          disabled={updatingTags}
                          style={isAssigned ? {
                            backgroundColor: tag.color,
                            borderColor: tag.color,
                            color: '#ffffff'
                          } : {
                            borderColor: tag.color,
                            color: tag.color,
                            backgroundColor: 'transparent'
                          }}
                        >
                          {tag.label}
                        </Button>
                      );
                    })}
                  {(!agentConfig?.widget_settings?.functions?.conversation_tags?.length) && (
                    <p className="text-sm text-muted-foreground">No tags configured</p>
                  )}
                </div>
              </div>
              
              {/* Notes Section */}
              <div>
                <Label htmlFor="note" className="mb-2 block">Note</Label>
                <Textarea 
                  id="note"
                  placeholder="Add a note about this conversation..."
                  className="min-h-[100px]"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button 
                  size="sm" 
                  className="mt-2 w-full" 
                  onClick={saveNote}
                  disabled={savingNote}
                >
                  {savingNote ? "Saving..." : "Save Note"}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground text-sm">
              Select a conversation to view options
            </div>
          )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
