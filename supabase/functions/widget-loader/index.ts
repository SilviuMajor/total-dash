import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agentId');

    if (!agentId) {
      throw new Error('agentId parameter is required');
    }

    console.log('Widget loader request for agent:', agentId);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch agent details including widget settings
    const { data: agent, error: agentError } = await supabaseClient
      .from('agents')
      .select('id, name, config, status')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      console.error('Agent fetch error:', agentError);
      throw new Error('Agent not found');
    }

    if (agent.status !== 'active') {
      throw new Error('Agent is not active');
    }

    const widgetSettings = agent.config?.widget_settings || {};
    const appearance = widgetSettings.appearance || {};
    const tabsConfig = widgetSettings.tabs || {};
    const functions = widgetSettings.functions || {};

    // Prepare configuration object
    const welcomeMessage = widgetSettings.welcome_message || {};
    const config = {
      agentId: agent.id,
      agentName: agent.name,
      title: widgetSettings.title || 'Chat with us',
      description: widgetSettings.description || "We're here to help",
      brandingUrl: widgetSettings.branding_url || '',
      welcomeMessage: {
        enabled: welcomeMessage.enabled || false,
        text: welcomeMessage.text || "👋 Hi there! How can I help you today?",
        delayMs: welcomeMessage.delay_ms || 1500,
        autoDismissSeconds: welcomeMessage.auto_dismiss_seconds || 0
      },
      appearance: {
        logoUrl: appearance.logo_url || '',
        chatIconUrl: appearance.chat_icon_url || '',
        backgroundImageUrl: appearance.background_image_url || '',
        primaryColor: appearance.primary_color || '#5B4FFF',
        secondaryColor: appearance.secondary_color || '#FFFFFF',
        textColor: appearance.text_color || '#000000',
        fontFamily: appearance.font_family || 'Inter',
        fontSize: appearance.font_size || 14,
        messageBubbleStyle: appearance.message_bubble_style || 'rounded',
        interactiveButtonStyle: appearance.interactive_button_style || 'solid',
      },
      tabs: {
        home: {
          enabled: tabsConfig.home?.enabled !== false,
          title: tabsConfig.home?.title || 'Welcome',
          subtitle: tabsConfig.home?.subtitle || 'How can we help you today?',
          buttons: tabsConfig.home?.buttons || [
            { id: 1, text: 'Start a new chat', enabled: true, action: 'new_chat' }
          ]
        },
        chats: {
          enabled: tabsConfig.chats?.enabled !== false
        },
        faq: {
          enabled: tabsConfig.faq?.enabled || false,
          items: tabsConfig.faq?.items || []
        }
      },
      functions: {
        messageTextColor: functions.message_text_color || '#000000',
        messageBgColor: functions.message_background_color || '#f3f4f6',
        fontSize: functions.font_size || '14px',
        typingDelayMs: functions.typing_delay_ms || 500,
        notificationSoundEnabled: functions.notification_sound_enabled || false,
        fileUploadEnabled: functions.file_upload_enabled || false
      }
    };

    // Generate the standalone JavaScript widget
    const widgetScript = generateWidgetScript(config);

    return new Response(widgetScript, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-store, no-cache, must-revalidate', // No caching for instant updates
      },
      status: 200,
    });
  } catch (error) {
    console.error('Error in widget-loader:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Return error as JavaScript comment
    return new Response(
      `console.error('Widget loader error: ${errorMessage}');`,
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/javascript',
        },
        status: 500,
      }
    );
  }
});

function generateWidgetScript(config: any): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const interactUrl = `${supabaseUrl}/functions/v1/voiceflow-interact`;

  return `
(function() {
  'use strict';
  
  function initWidget() {
    console.log('[VF Widget] Initializing for agent:', '${config.agentId}');
    
    // Configuration
    const CONFIG = ${JSON.stringify(config, null, 2)};
    const INTERACT_URL = '${interactUrl}';
    const SUPABASE_URL = '${supabaseUrl}';
    const SUPABASE_ANON_KEY = '${supabaseAnonKey}';
    const STORAGE_KEY = 'voiceflow_widget_' + CONFIG.agentId;
  
  // Session Manager
  const SessionManager = {
    initSession() {
      let session = this.getSession();
      if (!session) {
        session = {
          userId: 'user_' + Math.random().toString(36).substr(2, 9),
          currentConversationId: null,
          conversations: []
        };
        this.saveSession(session);
      }
      return session;
    },
    
    getSession() {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : null;
      } catch (e) {
        return null;
      }
    },
    
    saveSession(session) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } catch (e) {
        console.warn('Failed to save session:', e);
      }
    },
    
    saveConversation(conversationId, messages, voiceflowSessionId = null, hasUserInteraction = false) {
      const session = this.getSession();
      if (!session) return;
      
      const existingIndex = session.conversations.findIndex(c => c.id === conversationId);
      const existingConv = existingIndex >= 0 ? session.conversations[existingIndex] : null;
      
      const conversation = {
        id: conversationId,
        messages,
        timestamp: new Date().toISOString(),
        preview: messages.length > 0 
          ? (messages[messages.length - 1].text?.substring(0, 60) || 'New conversation')
          : 'New conversation',
        messageCount: messages.length,
        voiceflowSessionId: voiceflowSessionId || existingConv?.voiceflowSessionId || conversationId,
        hasUserInteraction: hasUserInteraction || existingConv?.hasUserInteraction || false
      };
      
      if (existingIndex >= 0) {
        session.conversations[existingIndex] = conversation;
      } else {
        session.conversations.unshift(conversation);
      }
      
      session.conversations = session.conversations.slice(0, 10);
      session.currentConversationId = conversationId;
      this.saveSession(session);
    },
    
    startNewConversation() {
      const session = this.getSession();
      if (session) {
        session.currentConversationId = null;
        this.saveSession(session);
      }
    },
    
    loadConversation(conversationId) {
      const session = this.getSession();
      return session?.conversations.find(c => c.id === conversationId);
    },
    
    getConversationHistory() {
      const session = this.getSession();
      // Only return conversations where user has interacted
      return (session?.conversations || []).filter(c => c.hasUserInteraction === true);
    }
  };
  
  // Load Google Fonts reliably
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = \`https://fonts.googleapis.com/css2?family=\${CONFIG.appearance.fontFamily.replace(' ', '+')}:wght@400;500;600;700&display=swap\`;
  document.head.appendChild(fontLink);
  
  // Inject CSS
  const style = document.createElement('style');
  style.textContent = \`
    * { box-sizing: border-box; }
    
    /* Welcome Message Bubble */
    .vf-welcome-bubble {
      position: fixed;
      bottom: 100px;
      right: 24px;
      max-width: 280px;
      padding: 12px 36px 12px 16px;
      background: \${CONFIG.appearance.primaryColor};
      color: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: \${CONFIG.appearance.fontFamily}, sans-serif;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      z-index: 999997;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: none;
    }
    
    .vf-welcome-bubble.vf-visible {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
    
    .vf-welcome-bubble.vf-hidden {
      display: none !important;
    }
    
    /* Speech bubble tail */
    .vf-welcome-bubble::after {
      content: '';
      position: absolute;
      bottom: -8px;
      right: 28px;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid \${CONFIG.appearance.primaryColor};
    }
    
    /* Close button */
    .vf-welcome-close {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    
    .vf-welcome-close:hover {
      background: rgba(255,255,255,0.3);
    }
    
    .vf-welcome-text {
      display: block;
    }
    
    /* Mobile adjustments for welcome bubble */
    @media (max-width: 640px) {
      .vf-welcome-bubble {
        right: 16px;
        bottom: 100px;
        max-width: 260px;
      }
    }
    
    /* Chat Icon Button */
    .vf-widget-button {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      z-index: 999998;
    }
    
    /* Custom icon - no background */
    .vf-widget-button.has-custom-icon {
      background: transparent;
      box-shadow: none;
      border-radius: 50%;
    }
    
    .vf-widget-button.has-custom-icon img {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      object-fit: cover;
    }
    
    .vf-widget-button.has-custom-icon:hover {
      transform: scale(1.05);
    }
    
    /* Default icon - colored background */
    .vf-widget-button.default-icon {
      background: \${CONFIG.appearance.primaryColor};
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    .vf-widget-button.default-icon:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }
    
    .vf-widget-button.default-icon svg {
      fill: white;
      width: 28px;
      height: 28px;
    }
    
    /* Widget Panel */
    .vf-widget-panel {
      position: fixed;
      bottom: 100px;
      right: 24px;
      width: 380px;
      max-width: calc(100vw - 48px);
      height: 600px;
      max-height: calc(100vh - 140px);
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      font-family: \${CONFIG.appearance.fontFamily}, sans-serif;
      overflow: hidden;
      transition: opacity 0.2s, transform 0.2s;
    }
    
    .vf-widget-panel.hidden {
      opacity: 0;
      transform: scale(0.95);
      pointer-events: none;
    }
    
    /* Header with gradient and wave */
    .vf-widget-header {
      position: relative;
      background: linear-gradient(135deg, \${CONFIG.appearance.primaryColor} 0%, \${CONFIG.appearance.primaryColor}dd 100%);
      color: \${CONFIG.appearance.secondaryColor};
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    
    .vf-widget-header img {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid \${CONFIG.appearance.secondaryColor}40;
      background: white;
      object-fit: cover;
    }
    
    .vf-widget-header-text {
      flex: 1;
    }
    
    .vf-widget-header-title {
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 2px;
    }
    
    .vf-widget-header-desc {
      font-size: 12px;
      opacity: 0.9;
    }
    
    .vf-widget-close {
      background: transparent;
      border: none;
      color: \${CONFIG.appearance.secondaryColor};
      cursor: pointer;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    
    .vf-widget-close:hover {
      background: rgba(255,255,255,0.2);
    }
    
    .vf-back-button {
      background: transparent;
      border: none;
      color: \${CONFIG.appearance.secondaryColor};
      cursor: pointer;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.2s;
      flex-shrink: 0;
      margin-left: -8px;
    }
    
    .vf-back-button:hover {
      background: rgba(255,255,255,0.2);
    }
    
    .vf-back-button svg {
      width: 20px;
      height: 20px;
    }
    
    .vf-wave-decoration {
      width: 100%;
      height: 32px;
    }
    
    /* Home Tab Gradient Header */
    .vf-home-gradient-header {
      position: relative;
      padding: 48px 24px 96px 24px;
      background: linear-gradient(160deg, \${CONFIG.appearance.primaryColor} 0%, \${CONFIG.appearance.primaryColor}dd 50%, transparent 100%);
    }
    
    .vf-home-logo-text {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .vf-home-logo {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: 3px solid \${CONFIG.appearance.secondaryColor};
      background: white;
      object-fit: cover;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    .vf-home-text {
      flex: 1;
    }
    
    .vf-home-title {
      font-size: 28px;
      font-weight: 700;
      color: \${CONFIG.appearance.secondaryColor};
      margin-bottom: 8px;
    }
    
    .vf-home-subtitle {
      font-size: 18px;
      font-weight: 500;
      color: \${CONFIG.appearance.secondaryColor};
      opacity: 0.95;
    }
    
    .vf-home-content {
      flex: 1 1 auto;
      background: #ffffff;
      padding: 0 24px 24px 24px;
      margin-top: -64px;
      position: relative;
      z-index: 10;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
      justify-content: flex-start;
    }
    
    .vf-home-buttons {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 24px;
    }
    
    .vf-home-button {
      width: 100%;
      padding: 16px;
      border: none;
      border-radius: 16px;
      background: rgba(0,0,0,0.03);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.2s;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      color: inherit;
    }
    
    .vf-home-button:hover {
      background: rgba(0,0,0,0.06);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    .vf-home-button-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .vf-home-button-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .vf-home-button-icon svg {
      width: 20px;
      height: 20px;
      stroke: \${CONFIG.appearance.primaryColor};
      fill: none;
    }
    
    .vf-home-button-arrow {
      color: rgba(0,0,0,0.4);
      transition: transform 0.2s;
    }
    
    .vf-home-button:hover .vf-home-button-arrow {
      transform: translateX(4px);
    }
    
    .vf-message-button.clicked {
      opacity: 0.6;
      cursor: not-allowed;
      pointer-events: none;
    }
    
    .vf-message-button.selected {
      background: \${CONFIG.appearance.primaryColor} !important;
      color: white !important;
      border-color: \${CONFIG.appearance.primaryColor} !important;
    }
    
    /* Floating close button for Home tab */
    .vf-floating-close {
      position: absolute;
      top: 16px;
      right: 16px;
      z-index: 50;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      backdrop-filter: blur(8px);
      border: none;
      color: \${CONFIG.appearance.secondaryColor};
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.2s;
    }
    
    .vf-floating-close:hover {
      background: rgba(255,255,255,0.3);
    }
    
    /* Content Area */
    .vf-widget-content {
      flex: 1 1 auto;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      min-height: 0;
      height: 100%;
    }
    
    /* Panel Content Container */
    #vf-panel-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      background: #ffffff;
      overscroll-behavior: contain;
    }
    
    .vf-widget-content::-webkit-scrollbar {
      width: 8px;
    }
    
    .vf-widget-content::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .vf-widget-content::-webkit-scrollbar-thumb {
      background: rgba(0,0,0,0.2);
      border-radius: 4px;
    }
    
    .vf-widget-content::-webkit-scrollbar-thumb:hover {
      background: rgba(0,0,0,0.3);
    }
    
    /* Chat List View */
    .vf-chats-header {
      padding: 20px 24px;
      flex-shrink: 0;
    }
    
    .vf-chats-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    
    .vf-chats-title-row svg {
      width: 20px;
      height: 20px;
      stroke: \${CONFIG.appearance.primaryColor};
    }
    
    .vf-chats-title {
      font-size: 18px;
      font-weight: 600;
    }
    
    .vf-new-chat-button {
      width: 100%;
      padding: 16px 8px 16px 16px;
      border: none;
      border-radius: 12px;
      background: \${CONFIG.appearance.primaryColor}25;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.2s;
      font-family: inherit;
      font-weight: 500;
    }
    
    .vf-new-chat-button:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    .vf-new-chat-arrow {
      width: 20px;
      height: 20px;
      stroke: rgba(0,0,0,0.4);
      flex-shrink: 0;
      transition: transform 0.2s;
    }
    
    .vf-new-chat-button:hover .vf-new-chat-arrow {
      transform: translateX(4px);
    }
    
    .vf-new-chat-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .vf-new-chat-content svg {
      width: 20px;
      height: 20px;
      stroke: \${CONFIG.appearance.primaryColor};
    }
    
    .vf-chats-section {
      padding: 0 16px 20px 24px;
    }
    
    .vf-chats-section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: rgba(0,0,0,0.5);
      margin-bottom: 12px;
    }
    
    .vf-conversation-card {
      width: 100%;
      padding: 16px 8px 16px 16px;
      border-radius: 12px;
      background: \${CONFIG.appearance.primaryColor}15;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: start;
      gap: 12px;
      margin-bottom: 8px;
    }
    
    .vf-conversation-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    .vf-conversation-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: \${CONFIG.appearance.primaryColor}30;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .vf-conversation-icon svg {
      width: 20px;
      height: 20px;
      stroke: \${CONFIG.appearance.primaryColor};
    }
    
    .vf-conversation-details {
      flex: 1;
      min-width: 0;
    }
    
    .vf-conversation-preview {
      font-weight: 500;
      font-size: 14px;
      margin-bottom: 4px;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      word-break: break-all;
    }
    
    .vf-conversation-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: rgba(0,0,0,0.5);
    }
    
    .vf-conversation-meta svg {
      width: 12px;
      height: 12px;
      stroke: currentColor;
    }
    
    .vf-conversation-badge {
      background: rgba(0,0,0,0.1);
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      margin-left: auto;
    }
    
    .vf-conversation-chevron {
      width: 20px;
      height: 20px;
      stroke: rgba(0,0,0,0.4);
      flex-shrink: 0;
      transition: transform 0.2s;
    }
    
    .vf-conversation-card:hover .vf-conversation-chevron {
      transform: translateX(2px);
    }
    
    .vf-empty-state {
      text-align: center;
      padding: 60px 32px;
      color: rgba(0,0,0,0.4);
    }
    
    .vf-empty-state svg {
      width: 48px;
      height: 48px;
      opacity: 0.3;
      margin: 0 auto 12px;
    }
    
    /* Messages View */
    .vf-messages-container {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      min-height: 0;
      overscroll-behavior: contain;
    }
    
    .vf-messages-container::-webkit-scrollbar {
      width: 8px;
    }
    
    .vf-messages-container::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .vf-messages-container::-webkit-scrollbar-thumb {
      background: rgba(0,0,0,0.2);
      border-radius: 4px;
    }
    
    .vf-messages-container::-webkit-scrollbar-thumb:hover {
      background: rgba(0,0,0,0.3);
    }
    
    .vf-message {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      animation: fadeIn 0.3s;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .vf-message.user {
      flex-direction: row-reverse;
    }
    
    .vf-message-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: \${CONFIG.appearance.primaryColor}20;
    }
    
    .vf-message-avatar img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }
    
    .vf-message-avatar svg {
      width: 16px;
      height: 16px;
      fill: \${CONFIG.appearance.primaryColor};
    }
    
    .vf-message-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-width: 75%;
    }
    
    .vf-message.user .vf-message-content {
      align-items: end;
    }
    
    .vf-message-bubble {
      padding: 12px 16px;
      word-wrap: break-word;
      border-radius: \${CONFIG.appearance.messageBubbleStyle === 'pill' ? '20px' : CONFIG.appearance.messageBubbleStyle === 'square' ? '4px' : '16px'};
    }
    
    .vf-message.assistant .vf-message-bubble {
      background: \${CONFIG.functions.messageBgColor};
      color: \${CONFIG.functions.messageTextColor};
    }
    
    .vf-message.user .vf-message-bubble {
      background: \${CONFIG.appearance.primaryColor};
      color: \${CONFIG.appearance.secondaryColor};
    }
    
    .vf-message-timestamp {
      font-size: 11px;
      color: rgba(0,0,0,0.4);
      padding: 0 4px;
    }
    
    .vf-message-buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 8px;
    }
    
    .vf-message-button {
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .vf-message-button.solid {
      background: \${CONFIG.appearance.primaryColor};
      color: \${CONFIG.appearance.secondaryColor};
      border: none;
    }
    
    .vf-message-button.outlined {
      background: transparent;
      color: \${CONFIG.appearance.primaryColor};
      border: 2px solid \${CONFIG.appearance.primaryColor};
    }
    
    .vf-message-button.soft {
      background: \${CONFIG.appearance.primaryColor}20;
      color: \${CONFIG.appearance.primaryColor};
      border: 1px solid \${CONFIG.appearance.primaryColor}50;
    }
    
    .vf-message-button:hover:not(:disabled) {
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transform: translateY(-1px);
    }
    
    .vf-message-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .vf-message-button.selected {
      background: \${CONFIG.appearance.primaryColor};
      color: \${CONFIG.appearance.secondaryColor};
      border: 2px solid \${CONFIG.appearance.primaryColor};
    }
    
    .vf-message-image {
      max-width: 100%;
      border-radius: 8px;
      margin-top: 8px;
      display: block;
      cursor: pointer;
    }
    
    .vf-message-file {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      margin-top: 8px;
      background: rgba(0,0,0,0.05);
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      transition: background 0.2s;
    }
    
    .vf-message-file:hover {
      background: rgba(0,0,0,0.1);
    }
    
    .vf-message-file svg {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }
    
    .vf-message-file span {
      font-size: 14px;
      font-weight: 500;
    }
    
    /* Typing Indicator */
    .vf-typing-container {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .vf-typing-indicator {
      display: flex;
      gap: 4px;
      padding: 12px 16px;
      background: rgba(0,0,0,0.05);
      border-radius: 16px;
      width: fit-content;
    }
    
    .vf-typing-dot {
      width: 8px;
      height: 8px;
      background: \${CONFIG.appearance.primaryColor}99;
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out both;
    }
    
    .vf-typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .vf-typing-dot:nth-child(2) { animation-delay: -0.16s; }
    
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
    
    /* Input Area */
    .vf-input-area {
      padding: 16px;
      background: \${CONFIG.appearance.primaryColor}08;
      border-top: 1px solid rgba(0,0,0,0.06);
      flex-shrink: 0;
    }
    
    .vf-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .vf-input-attach {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: transparent;
      border: none;
      color: rgba(0,0,0,0.5);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    
    .vf-input-attach:hover {
      background: rgba(0,0,0,0.05);
      color: rgba(0,0,0,0.7);
    }
    
    .vf-input-attach svg {
      width: 20px;
      height: 20px;
      stroke: currentColor;
    }
    
    .vf-input {
      flex: 1;
      padding: 12px 20px;
      border: none;
      border-radius: 24px;
      background: #ffffff;
      font-family: inherit;
      font-size: 14px;
      outline: none;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .vf-input:focus {
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    
    .vf-send-button {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: \${CONFIG.appearance.primaryColor};
      color: \${CONFIG.appearance.secondaryColor};
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .vf-send-button:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    
    .vf-send-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .vf-send-button svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }
    
    /* Bottom Tabs */
    .vf-bottom-tabs {
      display: flex;
      align-items: center;
      justify-content: space-around;
      padding: 8px;
      border-top: 1px solid rgba(0,0,0,0.1);
      background: #ffffff;
      flex-shrink: 0;
      margin-top: auto;
    }
    
    .vf-tab {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 12px;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.2s;
      font-family: inherit;
    }
    
    .vf-tab.active {
      background: \${CONFIG.appearance.primaryColor}15;
      color: \${CONFIG.appearance.primaryColor};
    }
    
    .vf-tab svg {
      width: 20px;
      height: 20px;
      stroke: currentColor;
    }
    
    .vf-tab-label {
      font-size: 12px;
      font-weight: 500;
    }
    
    /* Hide elements */
    .hidden {
      display: none !important;
    }
    
    /* Mobile Breakpoint - 640px */
    @media (max-width: 640px) {
      /* Hide chat button when widget is open on mobile */
      .vf-widget-panel:not(.hidden) ~ .vf-widget-button {
        display: none !important;
      }
      
      /* Chat Button - Larger on mobile with more spacing */
      .vf-widget-button {
        width: 70px;
        height: 70px;
        right: 24px;
        bottom: 24px;
      }
      
      .vf-widget-button.has-custom-icon img {
        width: 70px;
        height: 70px;
      }
      
      .vf-widget-button.default-icon svg {
        width: 28px;
        height: 28px;
      }
      
      /* Widget Panel - Full screen on mobile */
      .vf-widget-panel:not(.hidden) {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        height: 100dvh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        max-height: 100dvh !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        margin: 0 !important;
      }
      
      /* Header - Account for notches */
      .vf-widget-header {
        border-radius: 0;
        padding-top: max(20px, env(safe-area-inset-top));
        padding-left: max(20px, env(safe-area-inset-left));
        padding-right: max(20px, env(safe-area-inset-right));
      }
      
      /* Home gradient header */
      .vf-home-gradient-header {
        padding-top: max(48px, calc(48px + env(safe-area-inset-top)));
        padding-left: max(24px, env(safe-area-inset-left));
        padding-right: max(24px, env(safe-area-inset-right));
      }
      
      /* Bottom tabs - Account for home indicator */
      .vf-bottom-tabs {
        padding-bottom: max(8px, env(safe-area-inset-bottom));
      }
      
      .vf-widget-tabs {
        padding-bottom: max(8px, env(safe-area-inset-bottom));
      }
      
      /* Input area - Account for keyboard/home indicator */
      .vf-input-area {
        padding-bottom: max(12px, env(safe-area-inset-bottom));
        padding-left: max(12px, env(safe-area-inset-left));
        padding-right: max(12px, env(safe-area-inset-right));
      }
      
      /* Touch targets - Larger for mobile */
      .vf-message-button {
        min-height: 44px;
        padding: 12px 16px;
      }
      
      .vf-tab {
        min-height: 44px;
      }
      
      /* Input field - 16px prevents iOS zoom */
      .vf-input {
        font-size: 16px !important;
      }
      
      /* Home buttons - Better touch targets */
      .vf-home-button {
        min-height: 56px;
        padding: 16px 20px;
      }
    }
  \`;
  document.head.appendChild(style);
  
  // Widget State
  let isOpen = false;
  let messages = [];
  let conversationId = null;
  let userId = '';
  let currentVoiceflowSessionId = null;
  let isTyping = false;
  let currentTab = 'Home';
  let isInActiveChat = false;
  let clickedButtonIds = new Set();
  let clickedButtonSelections = {};
  
  // Helper to get the Voiceflow user ID (combined with session ID)
  function getVoiceflowUserId() {
    return currentVoiceflowSessionId ? \`\${userId}_\${currentVoiceflowSessionId}\` : userId;
  }
  
  // Helper function to format time ago
  function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    if (days < 7) return days + 'd ago';
    return new Date(date).toLocaleDateString();
  }
  
  // Helper function to format time
  function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // SVG Icons
  const icons = {
    messageSquare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>',
    messageCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    send: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>',
    paperclip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>',
    bot: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>'
  };
  
  // Create Widget Container
  const container = document.createElement('div');
  const hasCustomIcon = !!CONFIG.appearance.chatIconUrl;
  
  container.innerHTML = \`
    <button class="vf-widget-button \${hasCustomIcon ? 'has-custom-icon' : 'default-icon'}">
      \${hasCustomIcon 
        ? \`<img src="\${CONFIG.appearance.chatIconUrl}" alt="Chat" />\`
        : icons.messageSquare
      }
    </button>
    <div class="vf-widget-panel hidden">
      <div id="vf-panel-content"></div>
    </div>
  \`;
  document.body.appendChild(container);
  
  // Elements
  const chatButton = container.querySelector('.vf-widget-button');
  const chatPanel = container.querySelector('.vf-widget-panel');
  const panelContent = document.getElementById('vf-panel-content');
  
  // Initialize
  const session = SessionManager.initSession();
  userId = session.userId;
  
  if (session.currentConversationId) {
    const conv = SessionManager.loadConversation(session.currentConversationId);
    if (conv) {
      messages = conv.messages;
      conversationId = conv.id;
      currentVoiceflowSessionId = conv.voiceflowSessionId || conv.id;
      isInActiveChat = true;
      currentTab = 'Chats';
    }
  }
  
  // Render Functions
  function renderPanel() {
    // Save current input value before re-render
    const existingInput = document.getElementById('vf-input');
    const savedInputValue = existingInput ? existingInput.value : '';
    
    const showHeader = currentTab !== 'Home' || isInActiveChat;
    const showFloatingClose = currentTab === 'Home' && !isInActiveChat;
    const showBackButton = isInActiveChat && currentTab === 'Chats';
    const showTabs = !(currentTab === 'Chats' && isInActiveChat);
    const tabs = [];
    if (CONFIG.tabs.home.enabled) tabs.push('Home');
    if (CONFIG.tabs.chats.enabled) tabs.push('Chats');
    if (CONFIG.tabs.faq.enabled) tabs.push('FAQ');
    
    panelContent.innerHTML = \`
      \${showFloatingClose ? \`
        <button class="vf-floating-close" onclick="window.vfCloseWidget()">
          \${icons.x}
        </button>
      \` : ''}
      
      \${showHeader ? \`
        <div class="vf-widget-header">
          \${showBackButton ? \`
            <button class="vf-back-button" onclick="window.vfGoBack()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
          \` : ''}
          \${CONFIG.appearance.logoUrl ? \`<img src="\${CONFIG.appearance.logoUrl}" alt="Logo" />\` : ''}
          <div class="vf-widget-header-text">
            <div class="vf-widget-header-title">\${CONFIG.title}</div>
            <div class="vf-widget-header-desc">\${CONFIG.description}</div>
          </div>
          <button class="vf-widget-close" onclick="window.vfCloseWidget()">
            \${icons.x}
          </button>
        </div>
        <svg viewBox="0 0 400 50" class="vf-wave-decoration" preserveAspectRatio="none">
          <path d="M0,25 Q100,10 200,25 T400,25 L400,50 L0,50 Z" fill="\${CONFIG.appearance.secondaryColor}" opacity="0.15"/>
        </svg>
      \` : ''}
      
      <div class="vf-widget-content" id="vf-content"></div>
      
      \${isInActiveChat ? \`
        <div class="vf-input-area">
          <div class="vf-input-row">
            \${CONFIG.functions.fileUploadEnabled ? \`
              <input type="file" id="vf-file-input" accept="image/*,application/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" style="display: none;" />
              <button class="vf-input-attach" onclick="window.vfAttachFile()">
                \${icons.paperclip}
              </button>
            \` : ''}
            <input type="text" class="vf-input" id="vf-input" placeholder="Type your message..." />
            <button class="vf-send-button" onclick="window.vfSendMessage()">
              \${icons.send}
            </button>
          </div>
        </div>
      \` : ''}
      
      \${showTabs && tabs.length > 1 ? \`
        <div class="vf-bottom-tabs">
          \${tabs.map(tab => \`
            <button class="vf-tab \${tab === currentTab ? 'active' : ''}" onclick="window.vfSwitchTab('\${tab}')">
              \${tab === 'Home' ? icons.home : icons.messageSquare}
              <span class="vf-tab-label">\${tab}</span>
            </button>
          \`).join('')}
        </div>
      \` : ''}
    \`;
    
    renderContent();
    
    // Restore input value and re-attach Enter key listener
    const newInput = document.getElementById('vf-input');
    if (newInput) {
      newInput.value = savedInputValue;
      newInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') window.vfSendMessage();
      });
    }
    
    // Re-attach file input listener if present
    const fileInput = document.getElementById('vf-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', handleFileUpload);
    }
  }
  
  function renderContent() {
    const contentEl = document.getElementById('vf-content');
    if (!contentEl) return;
    
    if (currentTab === 'Home' && !isInActiveChat) {
      renderHome(contentEl);
    } else if (currentTab === 'Chats' || isInActiveChat) {
      if (isInActiveChat) {
        renderMessages(contentEl);
      } else {
        renderChatHistory(contentEl);
      }
    } else if (currentTab === 'FAQ') {
      renderFAQ(contentEl);
    }
  }
  
  function renderHome(container) {
    container.innerHTML = \`
      <div class="vf-home-gradient-header">
        <div class="vf-home-logo-text">
          \${CONFIG.appearance.logoUrl ? \`
            <img src="\${CONFIG.appearance.logoUrl}" alt="Logo" class="vf-home-logo" />
          \` : ''}
          <div class="vf-home-text">
            <h2 class="vf-home-title">\${CONFIG.tabs.home.title}</h2>
            <p class="vf-home-subtitle">\${CONFIG.tabs.home.subtitle}</p>
          </div>
        </div>
      </div>
      <div class="vf-home-content">
        <div class="vf-home-buttons">
          \${CONFIG.tabs.home.buttons.filter(btn => btn.enabled).map(btn => \`
            <button class="vf-home-button" onclick="window.vfHandleHomeAction('\${btn.action}', '\${btn.phoneNumber || ''}')">
              <div class="vf-home-button-content">
                <div class="vf-home-button-icon">
                  \${btn.action === 'call' ? icons.phone : icons.messageSquare}
                </div>
                <span>\${btn.text}</span>
              </div>
              <span class="vf-home-button-arrow">\${icons.chevronRight}</span>
            </button>
          \`).join('')}
        </div>
      </div>
    \`;
  }
  
  function renderChatHistory(container) {
    const history = SessionManager.getConversationHistory();
    
    if (history.length === 0) {
      container.innerHTML = \`
        <div class="vf-empty-state">
          \${icons.messageCircle}
          <p style="margin-bottom: 4px;">No conversations yet</p>
          <p style="font-size: 13px; opacity: 0.7;">Start a new chat to get going</p>
        </div>
      \`;
    } else {
      const recent = history[0];
      const older = history.slice(1);
      
      container.innerHTML = \`
        <div class="vf-chats-header">
          <div class="vf-chats-title-row">
            \${icons.messageSquare}
            <h3 class="vf-chats-title">Chats</h3>
          </div>
          <button class="vf-new-chat-button" onclick="window.vfStartNewChat()">
            <div class="vf-new-chat-content">
              \${icons.plus}
              <span>New Chat</span>
            </div>
            <span class="vf-new-chat-arrow">\${icons.chevronRight}</span>
          </button>
        </div>
        
        \${recent ? \`
          <div class="vf-chats-section">
            <div class="vf-chats-section-title">Continue recent conversation</div>
            <div class="vf-conversation-card" onclick="window.vfLoadConversation('\${recent.id}')">
              <div class="vf-conversation-icon">
                \${icons.messageCircle}
              </div>
              <div class="vf-conversation-details">
                <div class="vf-conversation-preview">\${recent.preview}</div>
                <div class="vf-conversation-meta">
                  \${icons.clock}
                  <span>\${formatTimeAgo(recent.timestamp)}</span>
                  <span class="vf-conversation-badge">\${recent.messageCount}</span>
                </div>
              </div>
              <span class="vf-conversation-chevron">\${icons.chevronRight}</span>
            </div>
          </div>
        \` : ''}
        
        \${older.length > 0 ? \`
          <div class="vf-chats-section">
            <div class="vf-chats-section-title">Previous conversations</div>
            \${older.map(conv => \`
              <div class="vf-conversation-card" onclick="window.vfLoadConversation('\${conv.id}')">
                <div class="vf-conversation-icon">
                  \${icons.messageCircle}
                </div>
                <div class="vf-conversation-details">
                  <div class="vf-conversation-preview">\${conv.preview}</div>
                  <div class="vf-conversation-meta">
                    \${icons.clock}
                    <span>\${formatTimeAgo(conv.timestamp)}</span>
                    <span class="vf-conversation-badge">\${conv.messageCount}</span>
                  </div>
                </div>
                <span class="vf-conversation-chevron">\${icons.chevronRight}</span>
              </div>
            \`).join('')}
          </div>
        \` : ''}
      \`;
    }
  }
  
  function scrollToLatestMessage() {
    const messagesEl = document.getElementById('vf-messages');
    if (messagesEl) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          messagesEl.scrollTop = messagesEl.scrollHeight;
        });
      });
    }
  }
  
  function renderMessages(container) {
    container.innerHTML = '<div class="vf-messages-container" id="vf-messages"></div>';
    const messagesEl = document.getElementById('vf-messages');
    
    messages.forEach(msg => {
      const messageDiv = document.createElement('div');
      messageDiv.className = \`vf-message \${msg.speaker}\`;
      
      const isAssistant = msg.speaker === 'assistant';
      const buttonStyle = CONFIG.appearance.interactiveButtonStyle || 'solid';
      
      // Parse message for file URLs
      let messageContent = msg.text || '';
      let fileUrl = null;
      let fileName = null;
      let isImage = false;
      
      // Detect file patterns: [Image: filename]\\nurl or [File: filename]\\nurl
      const fileMatch = messageContent.match(/\\[(Image|File): ([^\\]]+)\\]\\n(https?:\\/\\/[^\\s]+)/);
      if (fileMatch) {
        fileName = fileMatch[2];
        fileUrl = fileMatch[3];
        isImage = fileMatch[1] === 'Image' || /\\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
        messageContent = messageContent.replace(/\\[(Image|File): [^\\]]+\\]\\n[^\\s]+/, '').trim();
      }
      
      messageDiv.innerHTML = \`
        \${isAssistant ? \`
          <div class="vf-message-avatar">
            \${CONFIG.appearance.chatIconUrl 
              ? \`<img src="\${CONFIG.appearance.chatIconUrl}" alt="Bot" />\`
              : icons.bot
            }
          </div>
        \` : ''}
        <div class="vf-message-content">
          <div class="vf-message-bubble">
            \${messageContent ? \`<div>\${messageContent}</div>\` : ''}
            \${fileUrl ? (isImage 
              ? \`<img src="\${fileUrl}" alt="\${fileName}" class="vf-message-image" />\`
              : \`<a href="\${fileUrl}" target="_blank" class="vf-message-file" download="\${fileName}">
                  \${icons.paperclip}
                  <span>\${fileName}</span>
                </a>\`
            ) : ''}
            \${msg.buttons ? \`
              <div class="vf-message-buttons">
                \${msg.buttons.map((btn, idx) => {
                  const isClicked = clickedButtonIds.has(msg.id);
                  const isSelected = clickedButtonSelections[msg.id] === idx;
                  return \`
                    <button 
                      class="vf-message-button \${buttonStyle} \${isClicked ? 'clicked' : ''} \${isSelected ? 'selected' : ''}" 
                      \${isClicked ? 'disabled' : ''}
                      onclick="window.vfHandleButtonClick('\${msg.id}', \${idx})"
                    >
                      \${btn.text}
                    </button>
                  \`;
                }).join('')}
              </div>
            \` : ''}
          </div>
          <span class="vf-message-timestamp">\${formatTime(msg.timestamp)}</span>
        </div>
      \`;
      
      messagesEl.appendChild(messageDiv);
    });
    
    if (isTyping) {
      const typingDiv = document.createElement('div');
      typingDiv.className = 'vf-typing-container';
      typingDiv.innerHTML = \`
        <div class="vf-message-avatar">
          \${CONFIG.appearance.chatIconUrl 
            ? \`<img src="\${CONFIG.appearance.chatIconUrl}" alt="Bot" />\`
            : icons.bot
          }
        </div>
        <div class="vf-typing-indicator">
          <div class="vf-typing-dot"></div>
          <div class="vf-typing-dot"></div>
          <div class="vf-typing-dot"></div>
        </div>
      \`;
      messagesEl.appendChild(typingDiv);
    }
    
    scrollToLatestMessage();
  }
  
  function renderFAQ(container) {
    if (CONFIG.tabs.faq.items.length === 0) {
      container.innerHTML = \`
        <div class="vf-empty-state">
          <p>No FAQs available</p>
        </div>
      \`;
    } else {
      container.innerHTML = \`
        <div style="padding: 20px;">
          \${CONFIG.tabs.faq.items.map((item, i) => \`
            <details style="margin-bottom: 12px; padding: 16px; border-radius: 12px; background: rgba(0,0,0,0.03);">
              <summary style="cursor: pointer; font-weight: 600; font-size: 15px; outline: none;">\${item.question}</summary>
              <p style="margin-top: 12px; color: rgba(0,0,0,0.7); line-height: 1.5;">\${item.answer}</p>
            </details>
          \`).join('')}
        </div>
      \`;
    }
  }
  
  // File Upload Functions
  async function uploadFile(file) {
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be under 10MB');
      return null;
    }
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('agentId', CONFIG.agentId);
      
      const uploadResponse = await fetch(\`\${SUPABASE_URL}/functions/v1/widget-file-upload\`, {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      const result = await uploadResponse.json();
      return { fileName: result.fileName, publicUrl: result.publicUrl };
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file');
      return null;
    }
  }
  
  window.vfAttachFile = function() {
    const fileInput = document.getElementById('vf-file-input');
    if (fileInput) {
      fileInput.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const result = await uploadFile(file);
        if (result) {
          const isImage = /\\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
          const messageText = \`[\${isImage ? 'Image' : 'File'}: \${result.fileName}]\\n\${result.publicUrl}\`;
          sendMessage(messageText);
        }
        
        fileInput.value = '';
      };
      fileInput.click();
    }
  };
  
  // API Functions
  async function sendMessage(text) {
    if (!text?.trim()) return;
    
    const userMsg = {
      id: 'msg_' + Date.now(),
      speaker: 'user',
      text,
      timestamp: new Date().toISOString()
    };
    
    messages.push(userMsg);
    const input = document.getElementById('vf-input');
    if (input) input.value = '';
    isTyping = true;
    renderPanel();
    scrollToLatestMessage();
    
    try {
      const response = await fetch(INTERACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: CONFIG.agentId,
          userId: getVoiceflowUserId(),
          message: text,
          action: 'text',
          conversationId,
          isTestMode: false
        })
      });
      
      const data = await response.json();
      
      if (!conversationId && data.conversationId) {
        conversationId = data.conversationId;
      }
      
      if (data.botResponses) {
        for (const resp of data.botResponses) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.functions.typingDelayMs));
          
          const botMsg = {
            id: 'msg_' + Date.now(),
            speaker: 'assistant',
            text: resp.text,
            buttons: resp.buttons,
            timestamp: new Date().toISOString()
          };
          
          messages.push(botMsg);
          isTyping = false;
          renderPanel();
          scrollToLatestMessage();
        }
      } else {
        isTyping = false;
        renderPanel();
      }
      
      if (conversationId) {
        SessionManager.saveConversation(conversationId, messages, currentVoiceflowSessionId, true);
      }
    } catch (error) {
      console.error('Send message error:', error);
      isTyping = false;
      renderPanel();
    }
  }
  
  async function startNewChat() {
    messages = [];
    conversationId = null;
    currentVoiceflowSessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
    clickedButtonIds.clear();
    SessionManager.startNewConversation();
    
    isInActiveChat = true;
    currentTab = 'Chats';
    renderPanel();
    
    isTyping = true;
    renderPanel();
    
    try {
      // STEP 1: Reset Voiceflow state to clear previous variables
      const resetResponse = await fetch(INTERACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: CONFIG.agentId,
          userId: getVoiceflowUserId(),
          action: 'reset'
        })
      });
      
      // Log reset result but don't block on failure
      if (!resetResponse.ok) {
        console.warn('Reset failed, continuing with launch');
      }
      
      // STEP 2: Launch conversation with clean slate
      const response = await fetch(INTERACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: CONFIG.agentId,
          userId: getVoiceflowUserId(),
          action: 'launch',
          conversationId: null,
          isTestMode: false
        })
      });
      
      if (!response.ok) {
        console.error('Launch failed:', response.status);
        throw new Error('Launch request failed');
      }
      
      const data = await response.json();
      console.log('Launch response:', data);
      
      if (data.conversationId) {
        conversationId = data.conversationId;
      }
      
      if (data.botResponses) {
        for (const resp of data.botResponses) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.functions.typingDelayMs + 1000));
          
          const botMsg = {
            id: 'msg_' + Date.now(),
            speaker: 'assistant',
            text: resp.text,
            buttons: resp.buttons,
            timestamp: new Date().toISOString()
          };
          
          messages.push(botMsg);
          isTyping = false;
          renderPanel();
        }
      } else {
        isTyping = false;
        renderPanel();
      }
      
      // Save conversation immediately after bot responses (launch only, no user interaction yet)
      if (conversationId && messages.length > 0) {
        SessionManager.saveConversation(conversationId, messages, currentVoiceflowSessionId, false);
      }
    } catch (error) {
      console.error('Start chat error:', error);
      isTyping = false;
      renderPanel();
    }
  }
  
  async function handleButtonClick(messageId, buttonIndex) {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || !msg.buttons || !msg.buttons[buttonIndex]) return;
    
    clickedButtonIds.add(messageId);
    clickedButtonSelections[messageId] = buttonIndex;
    const button = msg.buttons[buttonIndex];
    
    const userMsg = {
      id: 'msg_' + Date.now(),
      speaker: 'user',
      text: button.text,
      timestamp: new Date().toISOString()
    };
    
    messages.push(userMsg);
    isTyping = true;
    renderPanel();
    
    try {
      const response = await fetch(INTERACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: CONFIG.agentId,
          userId: getVoiceflowUserId(),
          message: JSON.stringify(button.payload),
          action: 'button',
          conversationId,
          isTestMode: false
        })
      });
      
      const data = await response.json();
      
      if (data.botResponses) {
        for (const resp of data.botResponses) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.functions.typingDelayMs));
          
          const botMsg = {
            id: 'msg_' + Date.now(),
            speaker: 'assistant',
            text: resp.text,
            buttons: resp.buttons,
            timestamp: new Date().toISOString()
          };
          
          messages.push(botMsg);
          isTyping = false;
          renderPanel();
        }
      } else {
        isTyping = false;
        renderPanel();
      }
      
      if (conversationId) {
        SessionManager.saveConversation(conversationId, messages, currentVoiceflowSessionId, true);
      }
    } catch (error) {
      console.error('Button click error:', error);
      isTyping = false;
      renderPanel();
    }
  }
  
  // Global functions
  window.vfCloseWidget = function() {
    isOpen = false;
    chatPanel.classList.add('hidden');
  };
  
  window.vfSendMessage = function() {
    const input = document.getElementById('vf-input');
    if (input) {
      sendMessage(input.value);
    }
  };
  
  window.vfStartNewChat = startNewChat;
  
  window.vfLoadConversation = function(convId) {
    const conv = SessionManager.loadConversation(convId);
    if (conv) {
      messages = conv.messages;
      conversationId = conv.id;
      currentVoiceflowSessionId = conv.voiceflowSessionId || conv.id;
      isInActiveChat = true;
      renderPanel();
      scrollToLatestMessage();
    }
  };
  
  window.vfSwitchTab = function(tab) {
    currentTab = tab;
    if (tab !== 'Chats') {
      isInActiveChat = false;
    }
    renderPanel();
  };
  
  window.vfHandleHomeAction = function(action, phoneNumber) {
    if (action === 'new_chat') {
      startNewChat();
    } else if (action === 'call' && phoneNumber) {
      window.location.href = 'tel:' + phoneNumber;
    }
  };
  
  window.vfHandleButtonClick = handleButtonClick;
  
  window.vfGoBack = function() {
    isInActiveChat = false;
    renderPanel();
  };
  
  // Welcome Bubble Logic
  let welcomeBubble = null;
  let welcomeTimeout = null;
  let autoDismissTimeout = null;
  
  function createWelcomeBubble() {
    if (!CONFIG.welcomeMessage.enabled) return;
    
    const bubble = document.createElement('div');
    bubble.className = 'vf-welcome-bubble';
    bubble.innerHTML = \`
      <button class="vf-welcome-close" aria-label="Dismiss">×</button>
      <span class="vf-welcome-text">\${CONFIG.welcomeMessage.text}</span>
    \`;
    container.appendChild(bubble);
    welcomeBubble = bubble;
    
    // Close button click
    bubble.querySelector('.vf-welcome-close').addEventListener('click', (e) => {
      e.stopPropagation();
      hideWelcomeBubble();
    });
    
    // Text click - open widget to Home tab
    bubble.querySelector('.vf-welcome-text').addEventListener('click', () => {
      hideWelcomeBubble();
      isOpen = true;
      currentTab = 'Home';
      chatPanel.classList.remove('hidden');
      renderPanel();
    });
  }
  
  function showWelcomeBubble() {
    if (!CONFIG.welcomeMessage.enabled || !welcomeBubble || isOpen) return;
    
    welcomeTimeout = setTimeout(() => {
      if (!isOpen && welcomeBubble) {
        welcomeBubble.classList.add('vf-visible');
        
        // Auto-dismiss if configured
        if (CONFIG.welcomeMessage.autoDismissSeconds > 0) {
          autoDismissTimeout = setTimeout(() => {
            hideWelcomeBubble();
          }, CONFIG.welcomeMessage.autoDismissSeconds * 1000);
        }
      }
    }, CONFIG.welcomeMessage.delayMs);
  }
  
  function hideWelcomeBubble() {
    if (welcomeBubble) {
      welcomeBubble.classList.remove('vf-visible');
      welcomeBubble.classList.add('vf-hidden');
    }
    if (welcomeTimeout) {
      clearTimeout(welcomeTimeout);
      welcomeTimeout = null;
    }
    if (autoDismissTimeout) {
      clearTimeout(autoDismissTimeout);
      autoDismissTimeout = null;
    }
  }
  
  // Create welcome bubble
  createWelcomeBubble();
  
  // Event listeners
  chatButton.addEventListener('click', () => {
    isOpen = !isOpen;
    chatPanel.classList.toggle('hidden');
    if (isOpen) {
      hideWelcomeBubble();
      renderPanel();
    }
  });
  
  // Show welcome bubble after delay
  showWelcomeBubble();
  
  console.log('[VF Widget] Widget loaded successfully');
  }
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
`;
}
