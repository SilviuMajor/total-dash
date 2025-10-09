import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Paperclip, X, Plus, MessageSquare, ChevronRight, ArrowLeft, MessageCircle, Clock, Bot } from "lucide-react";
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

const WaveDecoration = ({ color }: { color: string }) => (
  <svg viewBox="0 0 400 50" className="w-full h-8" preserveAspectRatio="none">
    <path
      d="M0,25 Q100,10 200,25 T400,25 L400,50 L0,50 Z"
      fill={color}
      opacity="0.15"
    />
  </svg>
);

const TypingIndicator = () => (
  <div className="flex items-center gap-1 p-3 bg-muted/50 rounded-2xl w-fit">
    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

const ConversationCard = ({ conv, onClick, primaryColor }: any) => (
  <div
    className="p-4 rounded-xl cursor-pointer transition-all hover:shadow-md group"
    style={{ backgroundColor: `${primaryColor}15` }}
    onClick={onClick}
  >
    <div className="flex items-start gap-3">
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${primaryColor}30` }}
      >
        <MessageCircle className="w-5 h-5" style={{ color: primaryColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm line-clamp-2 mb-1">{conv.preview}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{formatDistanceToNow(new Date(conv.timestamp), { addSuffix: true })}</span>
          <Badge variant="secondary" className="ml-auto">{conv.messageCount}</Badge>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
    </div>
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

  const primaryColor = appearance.primary_color || '#5B4FFF';
  const secondaryColor = appearance.secondary_color || '#FFFFFF';
  const hasActiveChat = messages.length > 0;

  return (
    <div 
      className="w-full h-full flex flex-col bg-background shadow-2xl overflow-hidden"
      style={{ fontFamily: appearance.font_family || 'Inter' }}
    >
      {/* Header with gradient */}
      <div 
        className="relative"
        style={{ 
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
          color: secondaryColor
        }}
      >
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasActiveChat && messages.length > 0 && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={startNewChat}
                className="hover:bg-white/20 -ml-2"
                style={{ color: secondaryColor }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            {appearance.logo_url && (
              <div 
                className="w-11 h-11 rounded-full flex items-center justify-center border-2 overflow-hidden bg-white"
                style={{ borderColor: `${secondaryColor}40` }}
              >
                <img 
                  src={appearance.logo_url} 
                  alt="Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-base">{widgetSettings.title || "Chat with us"}</h3>
              <p className="text-xs opacity-90">{widgetSettings.description || "We're here to help"}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onClose}
            className="hover:bg-white/20"
            style={{ color: secondaryColor }}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <WaveDecoration color={secondaryColor} />
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
              <h2 className="text-3xl font-bold mb-3" style={{ color: appearance.text_color || '#000000' }}>
                {homeTab.title}
              </h2>
              <p className="text-muted-foreground mb-8 text-base">{homeTab.subtitle}</p>
              
              <div className="space-y-3 w-full px-4">
                {homeTab.buttons
                  ?.filter((btn: any) => btn.enabled)
                  .map((btn: any) => (
                    <button
                      key={btn.id}
                      className="w-full p-4 rounded-xl flex items-center justify-between transition-all hover:shadow-md group"
                      style={{ 
                        backgroundColor: `${primaryColor}15`,
                        color: appearance.text_color || '#000000'
                      }}
                      onClick={() => handleButtonAction(btn.action)}
                    >
                      <div className="flex items-center gap-3">
                        <MessageSquare className="w-5 h-5" style={{ color: primaryColor }} />
                        <span className="font-medium">{btn.text}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-2 ${message.speaker === 'user' ? 'justify-end' : 'justify-start items-start'}`}
                    >
                      {message.speaker === 'assistant' && (
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                          style={{ backgroundColor: `${primaryColor}20` }}
                        >
                          <Bot className="w-4 h-4" style={{ color: primaryColor }} />
                        </div>
                      )}
                      <div
                        className={`max-w-[75%] p-3.5 rounded-2xl shadow-sm ${
                          message.speaker === 'user'
                            ? ''
                            : 'bg-muted/80'
                        }`}
                        style={
                          message.speaker === 'user'
                            ? { 
                                backgroundColor: primaryColor,
                                color: secondaryColor
                              }
                            : { color: appearance.text_color || '#000000' }
                        }
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex gap-2 items-start">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${primaryColor}20` }}
                      >
                        <Bot className="w-4 h-4" style={{ color: primaryColor }} />
                      </div>
                      <TypingIndicator />
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="p-4" style={{ backgroundColor: `${primaryColor}08` }}>
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
                      className="rounded-full"
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
                    placeholder="Type your message..."
                    className="rounded-full bg-background border-0 shadow-sm"
                  />
                  <Button 
                    onClick={() => sendMessage(inputValue)}
                    className="rounded-full shadow-sm"
                    size="icon"
                    style={{ 
                      backgroundColor: primaryColor,
                      color: secondaryColor
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
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" style={{ color: primaryColor }} />
              <h3 className="font-semibold text-lg">Chats</h3>
            </div>
            
            <button
              className="w-full p-4 rounded-xl flex items-center justify-between transition-all hover:shadow-md group"
              style={{ backgroundColor: `${primaryColor}15` }}
              onClick={startNewChat}
            >
              <div className="flex items-center gap-3">
                <Plus className="w-5 h-5" style={{ color: primaryColor }} />
                <span className="font-medium">New Chat</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="px-5 pb-5 space-y-4">
              {conversationHistory.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground">No conversations yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Start a new chat to get going</p>
                </div>
              ) : (
                <>
                  {conversationHistory[0] && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Continue recent conversation
                      </h4>
                      <ConversationCard 
                        conv={conversationHistory[0]} 
                        onClick={() => loadConversation(conversationHistory[0].id)}
                        primaryColor={primaryColor}
                      />
                    </div>
                  )}
                  
                  {conversationHistory.length > 1 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Previous conversations
                      </h4>
                      <div className="space-y-2">
                        {conversationHistory.slice(1).map(conv => (
                          <ConversationCard 
                            key={conv.id}
                            conv={conv} 
                            onClick={() => loadConversation(conv.id)}
                            primaryColor={primaryColor}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
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
