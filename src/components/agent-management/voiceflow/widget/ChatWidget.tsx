import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Paperclip, X, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { widgetSessionManager } from "@/lib/widgetSession";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  speaker: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface ChatWidgetProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
  isTestMode: boolean;
  onClose: () => void;
}

const TypingIndicator = () => (
  <div className="flex items-center gap-1 p-3 bg-muted rounded-lg w-fit">
    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

export function ChatWidget({ agent, isTestMode, onClose }: ChatWidgetProps) {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState("Home");
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);

  const widgetSettings = agent.config?.widget_settings || {};
  const appearance = widgetSettings.appearance || {};
  const tabsConfig = widgetSettings.tabs || {};
  
  const homeTab = tabsConfig.home || { enabled: true, title: "Welcome", subtitle: "How can we help you today?", buttons: [] };
  const chatsTab = tabsConfig.chats || { enabled: true };
  const faqTab = tabsConfig.faq || { enabled: false, items: [] };

  // Initialize session on mount
  useEffect(() => {
    const session = widgetSessionManager.initSession(agent.id);
    setUserId(session.userId);
    
    // Load active conversation if exists
    if (session.currentConversationId) {
      const conv = widgetSessionManager.loadConversation(agent.id, session.currentConversationId);
      if (conv) {
        setMessages(conv.messages);
        setConversationId(conv.id);
        setSelectedTab("Home");
      }
    }
    
    // Load conversation history
    setConversationHistory(widgetSessionManager.getConversationHistory(agent.id));
  }, [agent.id]);

  // Save conversation after each message
  useEffect(() => {
    if (messages.length > 0 && conversationId) {
      widgetSessionManager.saveConversation(agent.id, {
        id: conversationId,
        messages
      });
      // Refresh history
      setConversationHistory(widgetSessionManager.getConversationHistory(agent.id));
    }
  }, [messages, conversationId, agent.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      speaker: 'user',
      text,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    try {
      const { data, error } = await supabase.functions.invoke('voiceflow-interact', {
        body: {
          agentId: agent.id,
          userId,
          message: text,
          conversationId,
          isTestMode
        }
      });

      if (error) throw error;

      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId);
      }

      if (data.botMessages && data.botMessages.length > 0) {
        data.botMessages.forEach((msg: string) => {
          const botMsg: Message = {
            id: crypto.randomUUID(),
            speaker: 'assistant',
            text: msg,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, botMsg]);
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be under 5MB",
        variant: "destructive"
      });
      return;
    }

    try {
      const fileName = `${agent.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('widget-assets')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('widget-assets')
        .getPublicUrl(fileName);

      sendMessage(`[File uploaded: ${file.name}]\n${publicUrl}`);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive"
      });
    }
  };

  const startNewChat = () => {
    widgetSessionManager.startNewConversation(agent.id);
    setMessages([]);
    setConversationId(null);
    setSelectedTab("Home");
  };

  const loadConversation = (convId: string) => {
    const conv = widgetSessionManager.loadConversation(agent.id, convId);
    if (conv) {
      setMessages(conv.messages);
      setConversationId(conv.id);
      setSelectedTab("Home");
    }
  };

  const handleButtonAction = (action: string) => {
    if (action === 'new_chat') {
      startNewChat();
    }
  };

  const buttonRadiusClass = 
    appearance.button_style === 'square' ? 'rounded-none' :
    appearance.button_style === 'pill' ? 'rounded-full' :
    'rounded-lg';

  const enabledTabs = [
    { key: 'Home', enabled: homeTab.enabled },
    { key: 'Chats', enabled: chatsTab.enabled },
    { key: 'FAQ', enabled: faqTab.enabled }
  ].filter(tab => tab.enabled);

  return (
    <div 
      className="w-[400px] h-[600px] flex flex-col bg-card rounded-lg shadow-xl border"
      style={{ fontFamily: appearance.font_family || 'Inter' }}
    >
      {/* Header */}
      <div 
        className="p-4 flex items-center justify-between border-b"
        style={{ 
          backgroundColor: appearance.primary_color || '#5B4FFF',
          color: appearance.secondary_color || '#FFFFFF'
        }}
      >
        <div className="flex items-center gap-3">
          {appearance.logo_url && (
            <img 
              src={appearance.logo_url} 
              alt="Logo" 
              className="h-8 w-8 object-contain rounded"
            />
          )}
          <div>
            <h3 className="font-semibold">{widgetSettings.title || "Chat with us"}</h3>
            <p className="text-xs opacity-90">{widgetSettings.description || "We're here to help"}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onClose}
          className="hover:bg-white/20"
          style={{ color: appearance.secondary_color || '#FFFFFF' }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      {enabledTabs.length > 1 && (
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="border-b">
          <TabsList className="w-full justify-start rounded-none h-auto p-0 bg-transparent">
            {enabledTabs.map((tab) => (
              <TabsTrigger 
                key={tab.key} 
                value={tab.key}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                {tab.key}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Tab Content */}
      {selectedTab === "Home" && homeTab.enabled && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center flex-1">
              <h2 className="text-2xl font-bold mb-2" style={{ color: appearance.text_color || '#000000' }}>
                {homeTab.title}
              </h2>
              <p className="text-muted-foreground mb-6">{homeTab.subtitle}</p>
              
              <div className="space-y-3 w-full max-w-xs">
                {homeTab.buttons
                  ?.filter((btn: any) => btn.enabled)
                  .map((btn: any) => (
                    <Button
                      key={btn.id}
                      className={`w-full ${buttonRadiusClass}`}
                      style={{ 
                        backgroundColor: appearance.primary_color || '#5B4FFF',
                        color: appearance.secondary_color || '#FFFFFF'
                      }}
                      onClick={() => handleButtonAction(btn.action)}
                    >
                      {btn.text}
                    </Button>
                  ))}
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 ${buttonRadiusClass} ${
                          message.speaker === 'user'
                            ? 'text-white'
                            : 'bg-muted'
                        }`}
                        style={
                          message.speaker === 'user'
                            ? { 
                                backgroundColor: appearance.primary_color || '#5B4FFF',
                                color: appearance.secondary_color || '#FFFFFF'
                              }
                            : { color: appearance.text_color || '#000000' }
                        }
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <TypingIndicator />
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="p-4 border-t">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      type="button"
                      asChild
                    >
                      <span>
                        <Paperclip className="w-5 h-5" />
                      </span>
                    </Button>
                  </label>
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(inputValue)}
                    placeholder="Type message..."
                    className={buttonRadiusClass}
                  />
                  <Button 
                    onClick={() => sendMessage(inputValue)}
                    className={buttonRadiusClass}
                    style={{ 
                      backgroundColor: appearance.primary_color || '#5B4FFF',
                      color: appearance.secondary_color || '#FFFFFF'
                    }}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {selectedTab === "Chats" && chatsTab.enabled && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 border-b">
            <Button
              className={`w-full ${buttonRadiusClass}`}
              onClick={startNewChat}
              style={{ 
                backgroundColor: appearance.primary_color || '#5B4FFF',
                color: appearance.secondary_color || '#FFFFFF'
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Start New Chat
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {conversationHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No conversations yet</p>
              ) : (
                conversationHistory.map(conv => (
                  <div
                    key={conv.id}
                    className="p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => loadConversation(conv.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium text-sm line-clamp-1">{conv.preview}</p>
                      <Badge variant="secondary" className="ml-2 text-xs">{conv.messageCount}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conv.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {selectedTab === "FAQ" && faqTab.enabled && (
        <ScrollArea className="flex-1 p-4">
          <Accordion type="single" collapsible className="space-y-2">
            {faqTab.items?.map((item: any, idx: number) => (
              <AccordionItem key={idx} value={`faq-${idx}`} className="border rounded-lg px-4">
                <AccordionTrigger className="text-left hover:no-underline">
                  <span className="font-medium">{item.question}</span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">{item.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          {(!faqTab.items || faqTab.items.length === 0) && (
            <p className="text-center text-muted-foreground py-8">No FAQ items yet</p>
          )}
        </ScrollArea>
      )}
    </div>
  );
}
