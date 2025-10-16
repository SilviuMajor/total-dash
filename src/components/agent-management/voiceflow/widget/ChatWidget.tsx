import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Paperclip, X, Plus, MessageSquare, ChevronRight, ArrowLeft, MessageCircle, Clock, Bot, Home, User, Phone } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { widgetSessionManager } from "@/lib/widgetSession";
import { formatDistanceToNow } from "date-fns";
import { MessageBubble } from "@/components/MessageBubble";

interface Message {
  id: string;
  speaker: 'user' | 'assistant';
  text?: string;
  buttons?: Array<{ text: string; payload: any }>;
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
    className="w-full max-w-full overflow-hidden p-4 pr-2 rounded-xl cursor-pointer transition-all hover:shadow-md group"
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
        <p 
          className="font-medium text-sm mb-1 break-all overflow-hidden"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}
        >
          {conv.preview}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{formatDistanceToNow(new Date(conv.timestamp), { addSuffix: true })}</span>
          <Badge variant="secondary" className="ml-auto">{conv.messageCount}</Badge>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
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
  const [isInActiveChat, setIsInActiveChat] = useState(false);
  const [clickedButtonMessageIds, setClickedButtonMessageIds] = useState<Set<string>>(new Set());
  const isStartingChatRef = useRef(false);

  const widgetSettings = agent.config?.widget_settings || {};
  const appearance = widgetSettings.appearance || {};
  const tabsConfig = widgetSettings.tabs || {};
  const functions = widgetSettings.functions || {};
  
  const homeTab = tabsConfig.home || { enabled: true, title: "Welcome", subtitle: "How can we help you today?", buttons: [] };
  const chatsTab = tabsConfig.chats || { enabled: true };
  const faqTab = tabsConfig.faq || { enabled: false, items: [] };

  const primaryColor = appearance.primary_color || '#5B4FFF';
  const secondaryColor = appearance.secondary_color || '#FFFFFF';
  const messageTextColor = functions.message_text_color || '#000000';
  const messageBgColor = functions.message_background_color || '#f3f4f6';
  const fontSize = functions.font_size || '14px';
  const typingDelay = functions.typing_delay_ms || 500;

  // Notification sound
  // Shared AudioContext - created once
  const audioContextRef = useRef<AudioContext | null>(null);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.warn('Failed to create AudioContext:', error);
      }
    }
  };

  const playNotificationSound = () => {
    if (!functions.notification_sound_enabled) return;
    
    try {
      // Initialize on first use (requires user interaction)
      if (!audioContextRef.current) {
        initAudioContext();
      }
      
      const audioContext = audioContextRef.current;
      if (!audioContext) {
        console.warn('AudioContext not available');
        return;
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.6, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  };

  // Initialize audio context on first user interaction
  useEffect(() => {
    const initAudio = () => {
      initAudioContext();
      document.removeEventListener('click', initAudio);
    };
    document.addEventListener('click', initAudio);
    return () => document.removeEventListener('click', initAudio);
  }, []);

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
        setIsInActiveChat(true);
      }
    }
    
    // Load conversation history (limit to 5 most recent)
    setConversationHistory(widgetSessionManager.getConversationHistory(agent.id).slice(0, 5));
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
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Check credentials
    if (!agent.config?.api_key || !agent.config?.project_id) {
      toast({
        title: "Configuration Error",
        description: "Voiceflow API credentials are missing.",
        variant: "destructive"
      });
      return;
    }

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
      console.log('Sending message:', text);
      const { data, error } = await supabase.functions.invoke('voiceflow-interact', {
        body: {
          agentId: agent.id,
          userId,
          message: text,
          action: 'text',
          conversationId,
          isTestMode
        }
      });

      if (error) {
        console.error('Message send error:', error);
        throw error;
      }

      console.log('Message response:', data);

      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Display bot responses sequentially with typing effect
      if (data.botResponses && data.botResponses.length > 0) {
        for (let i = 0; i < data.botResponses.length; i++) {
          const response = data.botResponses[i];
          
          // Show typing indicator before each message
          setIsTyping(true);
          await new Promise(resolve => setTimeout(resolve, typingDelay));
          
          const botMsg: Message = {
            id: crypto.randomUUID(),
            speaker: 'assistant',
            text: response.text,
            buttons: response.buttons,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, botMsg]);
          setIsTyping(false);
          
          // Play notification sound for each response
          playNotificationSound();
          
          // Small pause between multiple messages
          if (i < data.botResponses.length - 1) {
            await new Promise(resolve => setTimeout(resolve, typingDelay * 0.6));
          }
        }
      } else {
        setIsTyping(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
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

  const startNewChat = async () => {
    // Prevent concurrent executions
    if (isStartingChatRef.current) {
      console.log('Chat start already in progress, skipping...');
      return;
    }
    
    isStartingChatRef.current = true;
    
    try {
      // Check for credentials first
      if (!agent.config?.api_key || !agent.config?.project_id) {
        toast({
          title: "Configuration Error",
          description: "Voiceflow API credentials are missing. Please configure them in Settings.",
          variant: "destructive"
        });
        return;
      }

      // Clear ALL state FIRST to prevent duplication
      setMessages([]);
      setConversationId(null);
      setClickedButtonMessageIds(new Set());
      widgetSessionManager.startNewConversation(agent.id);

      // Navigate directly to active chat
      setIsInActiveChat(true);
      
      // Launch Voiceflow conversation to get opening message
      setIsTyping(true);
      
      console.log('Launching new Voiceflow conversation for agent:', agent.id);
      
      const { data, error } = await supabase.functions.invoke('voiceflow-interact', {
        body: {
          agentId: agent.id,
          userId,
          action: 'launch',
          conversationId: null,
          isTestMode
        }
      });

      if (error) {
        console.error('Launch error:', error);
        throw error;
      }

      console.log('Launch response:', data);

      // Set conversation ID
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Display initial bot responses
      if (data.botResponses && data.botResponses.length > 0) {
        for (let i = 0; i < data.botResponses.length; i++) {
          const response = data.botResponses[i];
          
          setIsTyping(true);
          await new Promise(resolve => setTimeout(resolve, typingDelay));
          
          const botMsg: Message = {
            id: crypto.randomUUID(),
            speaker: 'assistant',
            text: response.text,
            buttons: response.buttons,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, botMsg]);
          setIsTyping(false);
          
          playNotificationSound();
          
          if (i < data.botResponses.length - 1) {
            await new Promise(resolve => setTimeout(resolve, typingDelay * 0.6));
          }
        }
      }
    } catch (error) {
      console.error('Error launching conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start conversation. Please check your Voiceflow credentials.",
        variant: "destructive"
      });
      setIsTyping(false);
    } finally {
      // Always reset the guard
      isStartingChatRef.current = false;
    }
  };

  const loadConversation = (convId: string) => {
    const conv = widgetSessionManager.loadConversation(agent.id, convId);
    if (conv) {
      setMessages(conv.messages);
      setConversationId(conv.id);
      setIsInActiveChat(true);
    }
  };

  const handleBackButton = () => {
    if (selectedTab === "Chats" && isInActiveChat) {
      // Return to chat list
      setIsInActiveChat(false);
    } else {
      // Start new chat
      startNewChat();
    }
  };

  const handleButtonAction = (action: string, phoneNumber?: string) => {
    if (action === 'new_chat') {
      // Switch to Chats tab and start conversation there
      setSelectedTab("Chats");
      setIsInActiveChat(true);
      startNewChat();
    } else if (action === 'call' && phoneNumber) {
      // Trigger phone call
      window.location.href = `tel:${phoneNumber}`;
    } else if (action === 'custom') {
      // Handle custom action
      console.log('Custom action triggered');
    }
  };

  const getButtonIcon = (action: string) => {
    switch (action) {
      case "new_chat":
        return <MessageSquare className="w-5 h-5" style={{ color: primaryColor }} />;
      case "call":
        return <Phone className="w-5 h-5" style={{ color: primaryColor }} />;
      case "custom":
      default:
        return <MessageSquare className="w-5 h-5" style={{ color: primaryColor }} />;
    }
  };

  const handleButtonClick = async (payload: any, buttonText: string, messageId: string) => {
    // Mark this message's buttons as used
    setClickedButtonMessageIds(prev => new Set(prev).add(messageId));
    
    // Show user message with clean button text
    const userMsg: Message = {
      id: crypto.randomUUID(),
      speaker: 'user',
      text: buttonText,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      // Send button payload to Voiceflow
      const { data, error } = await supabase.functions.invoke('voiceflow-interact', {
        body: {
          agentId: agent.id,
          userId,
          message: JSON.stringify(payload),
          action: 'button',
          conversationId,
          isTestMode
        }
      });

      if (error) throw error;

      setConversationId(data.conversationId);

      // Display bot responses
      if (data.botResponses && data.botResponses.length > 0) {
        for (let i = 0; i < data.botResponses.length; i++) {
          const response = data.botResponses[i];
          
          setIsTyping(true);
          await new Promise(resolve => setTimeout(resolve, typingDelay));
          
          const botMsg: Message = {
            id: crypto.randomUUID(),
            speaker: 'assistant',
            text: response.text,
            buttons: response.buttons,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, botMsg]);
          setIsTyping(false);
          
          playNotificationSound();
          
          if (i < data.botResponses.length - 1) {
            await new Promise(resolve => setTimeout(resolve, typingDelay * 0.6));
          }
        }
      } else {
        setIsTyping(false);
      }
    } catch (error) {
      console.error('Error sending button click:', error);
      setIsTyping(false);
    }
  };

  const buttonRadiusClass = 
    appearance.button_style === 'square' ? 'rounded-none' :
    appearance.button_style === 'pill' ? 'rounded-full' :
    'rounded-lg';

  const enabledTabs = [
    { key: 'Home', enabled: homeTab.enabled, icon: Home },
    { key: 'Chats', enabled: chatsTab.enabled, icon: MessageSquare },
  ].filter(tab => tab.enabled);

  const hasActiveChat = isInActiveChat && messages.length > 0;

  return (
    <div 
      className="w-full h-full flex flex-col bg-background shadow-2xl overflow-hidden"
      style={{ fontFamily: appearance.font_family || 'Inter' }}
    >
      {/* Header with gradient - Hide completely on Home tab */}
      {selectedTab !== "Home" && (
        <div 
          className="relative"
          style={{ 
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
            color: secondaryColor
          }}
        >
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasActiveChat && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleBackButton}
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
      )}

      {/* Floating close button - only on Home tab when no active chat */}
      {selectedTab === "Home" && !isInActiveChat && (
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 w-10 h-10 p-0 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border-none shadow-lg"
          style={{ color: secondaryColor }}
        >
          <X className="w-5 h-5" />
        </Button>
      )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Home Tab Content */}
        {selectedTab === "Home" && homeTab.enabled && (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Gradient Header Section - extends to ~50% with fade */}
            <div 
              className="relative px-6 pt-12 pb-24"
              style={{ 
                background: `linear-gradient(160deg, ${primaryColor} 0%, ${primaryColor}dd 50%, transparent 100%)`,
              }}
            >
              <div className="flex items-center gap-4">
                {/* Logo on the left */}
                {appearance.logo_url && (
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden bg-white shadow-lg flex-shrink-0"
                    style={{ borderColor: secondaryColor, borderWidth: '3px', borderStyle: 'solid' }}
                  >
                    <img 
                      src={appearance.logo_url} 
                      alt="Logo" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
            {/* Text content on the right */}
            <div className="flex-1">
              <h2 
                className="text-3xl font-bold mb-2" 
                style={{ color: secondaryColor }}
              >
                {homeTab.title || appearance.widget_title || agent.name}
              </h2>
              
              <p 
                className="text-lg font-medium leading-relaxed" 
                style={{ color: secondaryColor, opacity: 0.95 }}
              >
                {homeTab.subtitle || "How can we help you today?"}
              </p>
            </div>
              </div>
            </div>

            {/* Content Section - overlaps gradient slightly */}
            <div className="flex-1 bg-background px-6 -mt-16 relative z-10">
              <div className="space-y-3">
                {/* Action Buttons */}
                {homeTab.buttons
                  ?.filter((btn: any) => btn.enabled)
                  .map((btn: any) => (
                    <button
                      key={btn.id}
                      className="w-full p-4 rounded-2xl flex items-center justify-between transition-all hover:shadow-md group bg-muted/50 hover:bg-muted/70"
                      onClick={() => handleButtonAction(btn.action, btn.phoneNumber)}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center bg-background"
                        >
                          {getButtonIcon(btn.action)}
                        </div>
                        <span className="font-semibold text-sm">{btn.text}</span>
                      </div>
                      <ChevronRight 
                        className="w-5 h-5 group-hover:translate-x-1 transition-transform text-muted-foreground" 
                      />
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Chats Tab Content */}
        {selectedTab === "Chats" && chatsTab.enabled && (
          <>
            {isInActiveChat && messages.length > 0 ? (
              // Active chat overlay
              <>
            <ScrollArea className="flex-1 min-h-0 p-4 overscroll-contain" style={{ scrollbarGutter: 'stable both-edges' }}>
                  <div className="space-y-4 pr-3">
                    {messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        speaker={message.speaker}
                        text={message.text}
                        buttons={message.buttons}
                        timestamp={message.timestamp}
                        appearance={{
                          primaryColor: primaryColor,
                          secondaryColor: secondaryColor,
                          textColor: appearance.text_color || '#000000',
                          chatIconUrl: appearance.chat_icon_url,
                          messageTextColor: messageTextColor,
                          messageBgColor: messageBgColor,
                          fontSize: appearance.font_size || 14,
                          messageBubbleStyle: appearance.message_bubble_style || 'rounded',
                          interactiveButtonStyle: appearance.interactive_button_style || 'solid'
                        }}
                        isWidget={true}
                        onButtonClick={(payload, text) => handleButtonClick(payload, text, message.id)}
                        buttonsDisabled={clickedButtonMessageIds.has(message.id)}
                      />
                    ))}
                    
                    {isTyping && (
                      <div className="flex gap-2 items-start">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                          style={{ backgroundColor: appearance.chat_icon_url ? 'transparent' : `${primaryColor}20` }}
                        >
                          {appearance.chat_icon_url ? (
                            <img src={appearance.chat_icon_url} alt="Bot" className="w-8 h-8 object-cover" />
                          ) : (
                            <Bot className="w-4 h-4" style={{ color: primaryColor }} />
                          )}
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
                      id="file-upload-chats"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                    />
                    <label htmlFor="file-upload-chats" className="cursor-pointer">
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
            ) : (
              // Chats list view
              <div className="flex flex-col h-full overflow-hidden min-h-0">
                <div className="flex-shrink-0 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" style={{ color: primaryColor }} />
                    <h3 className="font-semibold text-lg">Chats</h3>
                  </div>
                  
                  <button
                    className="w-full p-4 pr-2 rounded-xl flex items-center justify-between transition-all hover:shadow-md group"
                    style={{ backgroundColor: `${primaryColor}15` }}
                    onClick={startNewChat}
                  >
                    <div className="flex items-center gap-3">
                      <Plus className="w-5 h-5" style={{ color: primaryColor }} />
                      <span className="font-medium">New Chat</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
                
                <ScrollArea className="flex-1 min-h-0 overscroll-contain" style={{ scrollbarGutter: 'stable both-edges' }}>
                  <div className="pl-5 pr-3 pb-5 space-y-4 max-w-full">
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
          </>
        )}

        {/* FAQ Tab Content */}
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

        {/* Bottom Navigation Tabs - Hide when in active chat from Chats tab */}
        {enabledTabs.length > 1 && !(selectedTab === "Chats" && isInActiveChat) && (
        <div className="border-t bg-background">
          <div className="flex items-center justify-around p-2">
            {enabledTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = selectedTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setSelectedTab(tab.key);
                    if (tab.key !== "Chats") {
                      setIsInActiveChat(false);
                    }
                  }}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg transition-colors flex-1"
                  style={{
                    backgroundColor: isActive ? `${primaryColor}15` : 'transparent',
                    color: isActive ? primaryColor : 'inherit'
                  }}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{tab.key}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
