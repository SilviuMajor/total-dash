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
    
    const embedded = url.searchParams.get('embedded') === 'true';
    const testMode = url.searchParams.get('testMode') === 'true';

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
        textColor: appearance.text_color || '#000000',
        fontFamily: appearance.font_family || 'Inter',
        messageBubbleStyle: appearance.message_bubble_style || 'rounded',
        interactiveButtonStyle: appearance.interactive_button_style || 'solid',
        widgetMode: appearance.widget_mode || 'light',
        chatButtonColor: appearance.chat_button_color || '#000000',
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
      },
      poweredBy: {
        enabled: widgetSettings.powered_by?.enabled !== false,
        text: widgetSettings.powered_by?.text || 'TotalDash',
      },
      isEmbedded: embedded,
      isTestMode: testMode
    };

    // Generate the standalone JavaScript widget
    const widgetScript = generateWidgetScript(config);


    return new Response(widgetScript, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
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
  // Single unified theme — dark and light coexist spatially (no mode toggle)
  const theme = {
    canvas: '#F5F5F7',
    dark: '#0F0F12',
    darkInnerBg: 'rgba(255,255,255,0.10)',
    darkInnerFg: 'rgba(255,255,255,0.65)',
    darkText: '#ffffff',
    darkMuted: 'rgba(255,255,255,0.6)',
    surface: '#ffffff',
    surfaceBorder: 'rgba(0,0,0,0.06)',
    divider: 'rgba(0,0,0,0.08)',
    textPrimary: '#111111',
    textSecondary: '#666666',
    textMuted: '#888888',
    textFaint: '#bbbbbb',
    botBubble: '#EDEDEF',
    statusOnline: '#22c55e',
    avatarBg: '#C7D2FE',
    avatarFg: '#3730A3',
  };
  
  const accent = CONFIG.appearance.primaryColor;
  const buttonColor = CONFIG.appearance.chatButtonColor || '#0F0F12';
  
  // Helper: convert hex colour to rgba with alpha (for brand-tinted fills)
  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16);
    const g = parseInt(h.substr(2, 2), 16);
    const b = parseInt(h.substr(4, 2), 16);
    return \`rgba(\${r}, \${g}, \${b}, \${alpha})\`;
  }
  const accentTint = hexToRgba(accent, 0.10);
  const accentTintStrong = hexToRgba(accent, 0.12);
  
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
      background: \${accent};
      color: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px \${theme.shadow};
      font-family: \${CONFIG.appearance.fontFamily}, system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      z-index: 999997;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: none;
    }
    .vf-welcome-bubble.vf-visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
    .vf-welcome-bubble.vf-hidden { display: none !important; }
    .vf-welcome-bubble::after {
      content: '';
      position: absolute;
      bottom: -8px; right: 28px;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid \${accent};
    }
    .vf-welcome-close {
      position: absolute; top: 8px; right: 8px;
      background: rgba(255,255,255,0.2); border: none; color: white;
      width: 20px; height: 20px; border-radius: 50%; cursor: pointer;
      font-size: 14px; display: flex; align-items: center; justify-content: center;
    }
    .vf-welcome-close:hover { background: rgba(255,255,255,0.3); }
    
    /* Glow Ring Button */
    .vf-widget-button {
      position: fixed; bottom: 24px; right: 24px;
      width: 60px; height: 60px; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s; z-index: 999998;
      background: transparent; border-radius: 50%;
    }
    .vf-widget-button::before {
      content: '';
      position: absolute; inset: -5px; border-radius: 50%;
      background: \${buttonColor}; opacity: 0.15;
      animation: vf-glow 2s ease-in-out infinite;
    }
    .vf-widget-button::after {
      content: '';
      position: absolute; inset: -10px; border-radius: 50%;
      background: \${buttonColor}; opacity: 0.06;
      animation: vf-glow 2s ease-in-out infinite 0.3s;
    }
    @keyframes vf-glow {
      0%, 100% { transform: scale(1); opacity: 0.15; }
      50% { transform: scale(1.08); opacity: 0.08; }
    }
    .vf-widget-button .vf-btn-inner {
      width: 60px; height: 60px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      position: relative; z-index: 1;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .vf-widget-button.has-custom-icon .vf-btn-inner {
      background: transparent; box-shadow: none;
    }
    .vf-widget-button.has-custom-icon .vf-btn-inner img {
      width: 60px; height: 60px; border-radius: 50%; object-fit: cover;
    }
    .vf-widget-button.default-icon .vf-btn-inner {
      background: \${buttonColor};
      box-shadow: 0 4px 12px \${theme.shadow};
    }
    .vf-widget-button.default-icon .vf-btn-inner svg {
      fill: white; width: 28px; height: 28px;
    }
    .vf-widget-button:hover .vf-btn-inner {
      transform: scale(1.05);
    }
    
    /* Stop glow when panel is open */
    .vf-widget-panel:not(.hidden) ~ .vf-widget-button::before,
    .vf-widget-panel:not(.hidden) ~ .vf-widget-button::after {
      animation: none; opacity: 0;
    }
    
    /* Widget Panel */
    .vf-widget-panel {
      position: fixed; bottom: 100px; right: 24px;
      width: 380px; max-width: calc(100vw - 48px);
      height: 600px; max-height: calc(100vh - 140px);
      background: \${theme.bg};
      border-radius: 16px;
      border: 1px solid \${theme.panelBorder};
      box-shadow: 0 8px 32px \${theme.shadow};
      z-index: 999999;
      display: flex; flex-direction: column;
      font-family: \${CONFIG.appearance.fontFamily}, system-ui, sans-serif;
      overflow: hidden;
      transition: opacity 0.2s, transform 0.2s;
    }
    .vf-widget-panel.hidden {
      opacity: 0; transform: scale(0.95);
      pointer-events: none; visibility: hidden;
    }
    
    /* Panel Content Container */
    #vf-panel-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }

    /* Accent Stripe */
    .vf-accent-stripe {
      height: 3px; background: \${accent}; flex-shrink: 0;
    }
    
    /* Header */
    .vf-header {
      padding: 12px 16px;
      border-bottom: 1px solid \${theme.border};
      display: flex; justify-content: space-between; align-items: center;
      flex-shrink: 0;
    }
    .vf-header-left { display: flex; align-items: center; gap: 8px; }
    .vf-header-title { font-size: 14px; font-weight: 500; color: \${theme.text}; margin: 0; }
    .vf-header-btn {
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; border: none;
      background: \${theme.bgSurface}; color: \${theme.textSecondary};
      transition: background 0.2s;
    }
    .vf-header-btn:hover { background: \${theme.bgSurfaceHover}; }
    .vf-header-btn svg { width: 14px; height: 14px; }
    
    /* Logo Badge */
    .vf-logo-badge {
      width: 34px; height: 34px; border-radius: 9px;
      background: \${accent};
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 500; font-size: 13px;
      flex-shrink: 0; overflow: hidden;
    }
    .vf-logo-badge img { width: 100%; height: 100%; object-fit: cover; }
    .vf-logo-badge-sm {
      width: 24px; height: 24px; border-radius: 50%;
      background: \${accent};
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 500; font-size: 10px;
      flex-shrink: 0; overflow: hidden;
    }
    .vf-logo-badge-sm img { width: 100%; height: 100%; object-fit: cover; }
    .vf-logo-badge-sm { overflow: hidden; }
    
    /* Home Screen */
    .vf-home { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .vf-home-hero {
      padding: 24px 20px 20px; flex-shrink: 0;
    }
    .vf-home-hero-top {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px;
    }
    .vf-home-title {
      font-size: 24px; font-weight: 500; color: \${theme.text};
      margin: 0 0 4px; line-height: 1.15; letter-spacing: -0.3px;
    }
    .vf-home-status {
      display: flex; align-items: center; gap: 5px; margin-top: 8px;
    }
    .vf-home-status-dot {
      width: 6px; height: 6px; border-radius: 50%; background: #4ade80;
    }
    .vf-home-status-text { font-size: 11px; color: \${theme.textMuted}; }
    
    .vf-home-actions {
      flex: 1; padding: 0 14px; display: flex; flex-direction: column; gap: 8px;
      overflow-y: auto;
    }
    .vf-home-button {
      padding: 14px; border-radius: 12px;
      background: \${theme.bgSurface}; border: 1px solid \${theme.border};
      display: flex; align-items: center; gap: 12px;
      cursor: pointer; transition: background 0.2s; width: 100%;
      text-align: left; color: \${theme.text}; font-family: inherit;
    }
    .vf-home-button:hover { background: \${theme.bgSurfaceHover}; }
    .vf-home-button-icon {
      width: 34px; height: 34px; border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .vf-home-button-icon.primary { background: \${accent}; }
    .vf-home-button-icon.primary svg { stroke: white; }
    .vf-home-button-icon.secondary { background: \${theme.bgSurface}; border: 1px solid \${theme.border}; }
    .vf-home-button-icon.secondary svg { stroke: \${theme.textSecondary}; }
    .vf-home-button-text { flex: 1; }
    .vf-home-button-text strong { font-size: 14px; font-weight: 500; display: block; color: \${theme.text}; }
    .vf-home-button-text span { font-size: 11px; color: \${theme.textMuted}; margin-top: 2px; display: block; }
    .vf-home-button-chevron { color: \${theme.textFaint}; flex-shrink: 0; }
    .vf-home-button-chevron svg { width: 12px; height: 12px; }
    
    /* Powered By */
    .vf-powered-by {
      padding: 8px 14px; text-align: center; flex-shrink: 0;
    }
    .vf-powered-by span {
      font-size: 9px; color: \${theme.textFaint};
      letter-spacing: 0.5px; text-transform: uppercase;
    }
    
    /* Chat History */
    .vf-chat-list { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .vf-chat-list-header {
      padding: 16px 16px 12px;
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    }
    .vf-chat-list-title { font-size: 16px; font-weight: 500; color: \${theme.text}; }
    .vf-new-chat-btn {
      padding: 14px; border-radius: 12px;
      background: \${theme.bgSurface}; border: 1px solid \${theme.border};
      display: flex; align-items: center; gap: 12px;
      cursor: pointer; transition: background 0.2s; width: 100%;
      margin: 0 16px 8px; color: \${theme.text}; font-family: inherit;
      text-align: left;
    }
    .vf-new-chat-btn:hover { background: \${theme.bgSurfaceHover}; }
    .vf-new-chat-btn svg { width: 18px; height: 18px; flex-shrink: 0; }
    .vf-chat-list-scroll { flex: 1; overflow-y: auto; padding: 0 16px 16px; }
    .vf-chat-section-label {
      font-size: 10px; font-weight: 600; color: \${theme.textMuted};
      text-transform: uppercase; letter-spacing: 0.5px;
      margin: 12px 0 8px;
    }
    .vf-conv-card {
      padding: 12px 14px; border-radius: 12px;
      background: \${theme.bgSurface}; border: 1px solid \${theme.border};
      margin-bottom: 6px; cursor: pointer;
      transition: background 0.2s;
    }
    .vf-conv-card:hover { background: \${theme.bgSurfaceHover}; }
    .vf-conv-card-preview {
      font-size: 13px; color: \${theme.text}; margin: 0 0 4px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .vf-conv-card-meta {
      font-size: 11px; color: \${theme.textMuted};
      display: flex; align-items: center; gap: 6px;
    }
    .vf-conv-card-meta svg { width: 11px; height: 11px; flex-shrink: 0; }
    .vf-conv-card-count {
      font-size: 10px; background: \${theme.bgSurfaceHover};
      padding: 1px 6px; border-radius: 8px; color: \${theme.textSecondary};
      margin-left: auto;
    }
    
    /* Messages Area */
    .vf-messages-wrap {
      flex: 1; overflow-y: auto; padding: 20px 20px 16px;
      display: flex; flex-direction: column; gap: 16px;
      scroll-behavior: smooth;
    }
    
    /* Bot message - flowing text, no bubble */
    .vf-msg-bot {
      font-size: 15px; color: \${theme.text}; line-height: 1.55;
      margin: 0; max-width: 100%; word-wrap: break-word;
    }
    .vf-msg-bot img { max-width: 100%; height: auto; border-radius: 8px; margin-top: 6px; }
    .vf-msg-bot a { color: \${accent}; text-decoration: underline; }
    .vf-msg-time {
      font-size: 10px; color: \${theme.textMuted}; margin-top: 5px;
    }
    
    /* User message - compact coloured pill */
    .vf-msg-user-wrap { display: flex; justify-content: flex-end; }
    .vf-msg-user {
      background: \${accent}; border-radius: 18px;
      padding: 9px 16px; max-width: 75%;
      font-size: 14px; color: white; line-height: 1.4; margin: 0;
      word-wrap: break-word;
    }
    
    /* Interactive buttons - standalone below bot text */
    .vf-buttons {
      display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;
    }
    .vf-btn-option {
      padding: 8px 16px; border-radius: 18px;
      border: 1px solid \${theme.borderHover};
      background: transparent; color: \${theme.text};
      font-size: 13px; font-weight: 500; cursor: pointer;
      font-family: inherit; transition: background 0.15s, border-color 0.15s;
    }
    .vf-btn-option:hover {
      background: \${theme.bgSurface}; border-color: \${theme.textMuted};
    }
    .vf-btn-option.selected {
      background: \${accent}; color: white;
      border-color: \${accent};
    }
    .vf-btn-option:disabled {
      opacity: 0.4; cursor: default;
    }
    
    /* Typing Indicator */
    .vf-typing { display: flex; gap: 4px; padding: 4px 0; }
    .vf-typing-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: \${theme.textMuted};
      animation: vf-bounce 1.2s ease-in-out infinite;
    }
    .vf-typing-dot:nth-child(2) { animation-delay: 0.15s; }
    .vf-typing-dot:nth-child(3) { animation-delay: 0.3s; }
    @keyframes vf-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }
    
    /* Input Bar */
    .vf-input-bar {
      padding: 12px 16px; border-top: 1px solid \${theme.border};
      flex-shrink: 0;
    }
    .vf-input-row { display: flex; align-items: center; gap: 8px; }
    .vf-input-field {
      flex: 1; background: \${theme.inputBg};
      border: 1px solid \${theme.inputBorder};
      border-radius: 22px; padding: 10px 16px;
      font-size: 14px; color: \${theme.text};
      font-family: inherit; outline: none;
      transition: border-color 0.2s;
    }
    .vf-input-field::placeholder { color: \${theme.textMuted}; }
    .vf-input-field:focus { border-color: \${accent}; }
    .vf-attach-btn {
      width: 36px; height: 36px; border-radius: 50%;
      border: none; background: transparent;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: \${theme.textMuted};
      flex-shrink: 0; transition: color 0.2s;
    }
    .vf-attach-btn:hover { color: \${theme.textSecondary}; }
    .vf-attach-btn svg { width: 18px; height: 18px; }
    .vf-send-btn {
      width: 36px; height: 36px; border-radius: 50%;
      border: none; background: \${accent};
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; flex-shrink: 0;
      transition: opacity 0.2s;
    }
    .vf-send-btn:hover { opacity: 0.9; }
    .vf-send-btn svg { width: 14px; height: 14px; fill: white; }
    
    /* Tab Navigation */
    .vf-tabs {
      border-top: 1px solid \${theme.border};
      display: flex; justify-content: center; gap: 32px;
      padding: 8px 0; flex-shrink: 0;
    }
    .vf-tab {
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      padding: 6px 12px; border-radius: 8px;
      cursor: pointer; border: none; background: transparent;
      font-family: inherit; transition: background 0.2s;
    }
    .vf-tab svg { width: 18px; height: 18px; }
    .vf-tab span { font-size: 11px; font-weight: 500; }
    .vf-tab.active { color: \${accent}; }
    .vf-tab.active svg { fill: \${accent}; stroke: \${accent}; }
    .vf-tab:not(.active) { color: \${theme.textMuted}; }
    .vf-tab:not(.active) svg { stroke: \${theme.textMuted}; fill: none; }
    
    /* Handover - agent message */
    .vf-msg-agent {
      background: \${theme.bgSurface}; border: 1px solid \${theme.border};
      border-radius: 14px; padding: 10px 14px;
      font-size: 15px; color: \${theme.text}; line-height: 1.5;
      max-width: 85%;
    }
    
    /* System messages */
    .vf-msg-system {
      text-align: center; font-size: 12px; color: \${theme.textMuted};
      padding: 8px 0;
    }
    
    /* File preview in message */
    .vf-file-preview { max-width: 200px; height: auto; border-radius: 8px; margin-top: 4px; display: block; }
    .vf-file-link {
      color: \${accent}; font-size: 13px; text-decoration: underline;
      display: inline-block; margin-top: 4px;
    }
    
    /* FAQ */
    .vf-faq-wrap { flex: 1; overflow-y: auto; padding: 16px; }
    .vf-faq-item {
      border: 1px solid \${theme.border}; border-radius: 10px;
      margin-bottom: 8px; overflow: hidden;
    }
    .vf-faq-q {
      padding: 12px 16px; cursor: pointer; font-size: 14px; font-weight: 500;
      color: \${theme.text}; background: transparent; border: none;
      width: 100%; text-align: left; font-family: inherit;
      display: flex; justify-content: space-between; align-items: center;
    }
    .vf-faq-q:hover { background: \${theme.bgSurface}; }
    .vf-faq-q svg { width: 14px; height: 14px; color: \${theme.textMuted}; transition: transform 0.2s; flex-shrink: 0; }
    .vf-faq-q.open svg { transform: rotate(180deg); }
    .vf-faq-a {
      padding: 0 16px 12px; font-size: 14px; color: \${theme.textSecondary};
      line-height: 1.6; display: none;
    }
    .vf-faq-a.open { display: block; }
    
    /* Empty state */
    .vf-empty {
      text-align: center; padding: 40px 20px; color: \${theme.textMuted};
    }
    .vf-empty svg { width: 40px; height: 40px; margin-bottom: 12px; opacity: 0.3; color: \${theme.textMuted}; }
    .vf-empty p { margin: 4px 0; font-size: 14px; }
    .vf-empty p:last-child { font-size: 13px; }
    
    /* Global SVG constraints */
    .vf-home-button-icon svg,
    .vf-header-btn svg,
    .vf-home-button-chevron svg { width: 16px; height: 16px; }
    .vf-home-button-icon svg { width: 15px; height: 15px; }
    .vf-empty svg { width: 40px; height: 40px; }
    button svg { flex-shrink: 0; }
    
    /* Scrollbar */
    .vf-messages-wrap::-webkit-scrollbar,
    .vf-chat-list-scroll::-webkit-scrollbar,
    .vf-faq-wrap::-webkit-scrollbar {
      width: 4px;
    }
    .vf-messages-wrap::-webkit-scrollbar-thumb,
    .vf-chat-list-scroll::-webkit-scrollbar-thumb,
    .vf-faq-wrap::-webkit-scrollbar-thumb {
      background: \${theme.borderHover}; border-radius: 4px;
    }
    .vf-messages-wrap::-webkit-scrollbar-track,
    .vf-chat-list-scroll::-webkit-scrollbar-track,
    .vf-faq-wrap::-webkit-scrollbar-track {
      background: transparent;
    }
    
    /* Mobile */
    @media (max-width: 640px) {
      .vf-widget-panel {
        bottom: 0; right: 0; left: 0;
        width: 100%; max-width: 100%;
        height: 100vh; max-height: 100vh;
        border-radius: 0;
      }
      .vf-welcome-bubble { right: 16px; bottom: 100px; max-width: 260px; }
    }
    
    /* Embedded mode overrides */
    \${CONFIG.isEmbedded ? \`
      .vf-widget-panel {
        position: relative; bottom: auto; right: auto;
        width: 100%; height: 100vh;
        border-radius: 0; box-shadow: none; border: none;
        max-width: none; max-height: none;
      }
    \` : ''}
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
  let isInHandover = false;
  let isConversationEnded = false;
  let realtimeSubscription = null;
  
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
    messageSquare: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
    chevronRight: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>',
    messageCircle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>',
    clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>',
    paperclip: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>',
    bot: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>',
    phone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 1 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>'
  };
  
  // Create Widget Container
  const container = document.createElement('div');
  const hasCustomIcon = !!CONFIG.appearance.chatIconUrl;
  
  if (CONFIG.isEmbedded) {
    container.innerHTML = \`
      <div class="vf-widget-panel">
        <div id="vf-panel-content"></div>
      </div>
    \`;
    document.body.appendChild(container);
  } else {
    container.innerHTML = \`
      <button class="vf-widget-button \${hasCustomIcon ? 'has-custom-icon' : 'default-icon'}">
        <div class="vf-btn-inner">
          \${hasCustomIcon 
            ? \`<img src="\${CONFIG.appearance.chatIconUrl}" alt="Chat" />\`
            : icons.messageSquare
          }
        </div>
      </button>
      <div class="vf-widget-panel hidden">
        <div id="vf-panel-content"></div>
      </div>
    \`;
    document.body.appendChild(container);
  }
  
  // Elements
  const chatButton = CONFIG.isEmbedded ? null : container.querySelector('.vf-widget-button');
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
    const existingInput = document.getElementById('vf-input');
    const savedInputValue = existingInput ? existingInput.value : '';
    
    const isHome = currentTab === 'Home' && !isInActiveChat;
    const showBackButton = isInActiveChat && currentTab === 'Chats';
    const showTabs = !(currentTab === 'Chats' && isInActiveChat);
    const tabs = [];
    if (CONFIG.tabs.home.enabled) tabs.push('Home');
    if (CONFIG.tabs.chats.enabled) tabs.push('Chats');
    if (CONFIG.tabs.faq.enabled) tabs.push('FAQ');
    
    const headerTitle = isInActiveChat ? 'New conversation' : 'Chat';
    
    panelContent.innerHTML = \`
      <div class="vf-accent-stripe"></div>
      
      \${isHome ? \`
        <div id="vf-content" style="flex:1;display:flex;flex-direction:column;overflow:hidden;"></div>
      \` : \`
        <div class="vf-header">
          <div class="vf-header-left">
            \${showBackButton ? \`
              <button class="vf-header-btn" onclick="window.vfGoBack()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
            \` : ''}
            \${CONFIG.appearance.logoUrl ? \`
              <div class="vf-logo-badge-sm"><img src="\${CONFIG.appearance.logoUrl}" alt="Logo" /></div>
            \` : ''}
            <p class="vf-header-title">\${headerTitle}</p>
          </div>
          <button class="vf-header-btn" onclick="window.vfCloseWidget()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="vf-content" style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0;"></div>
      \`}
      
      \${isInActiveChat ? \`
        <div class="vf-input-bar">
          \${isConversationEnded ? \`
            <button class="vf-btn-option" style="width:100%;justify-content:center;" onclick="window.vfStartNewChat()">
              + New Conversation
            </button>
          \` : \`
            <div class="vf-input-row">
              \${CONFIG.functions.fileUploadEnabled ? \`
                <input type="file" id="vf-file-input" accept="image/*,application/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" style="display:none;" />
                <button class="vf-attach-btn" onclick="window.vfAttachFile()">
                  \${icons.paperclip}
                </button>
              \` : ''}
              <input type="text" class="vf-input-field" id="vf-input" placeholder="Type a message..." />
              <button class="vf-send-btn" onclick="window.vfSendMessage()">
                \${icons.send}
              </button>
            </div>
          \`}
        </div>
      \` : ''}
      
      \${showTabs && tabs.length > 1 ? \`
        <div class="vf-tabs">
          \${tabs.map(tab => \`
            <button class="vf-tab \${tab === currentTab ? 'active' : ''}" onclick="window.vfSwitchTab('\${tab}')">
              \${tab === 'Home' ? icons.home : tab === 'FAQ' ? \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>\` : icons.messageSquare}
              <span>\${tab}</span>
            </button>
          \`).join('')}
        </div>
      \` : ''}
    \`;
    
    renderContent();
    
    const newInput = document.getElementById('vf-input');
    if (newInput) {
      newInput.value = savedInputValue;
      newInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') window.vfSendMessage();
      });
    }
    
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
    const logoHtml = CONFIG.appearance.logoUrl 
      ? \`<div class="vf-logo-badge"><img src="\${CONFIG.appearance.logoUrl}" alt="Logo" /></div>\`
      : \`<div class="vf-logo-badge">\${CONFIG.agentName.charAt(0).toUpperCase()}</div>\`;
    
    container.innerHTML = \`
      <div class="vf-home">
        <div class="vf-home-hero">
          <div class="vf-home-hero-top">
            \${logoHtml}
            <button class="vf-header-btn" onclick="window.vfCloseWidget()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <h2 class="vf-home-title">\${CONFIG.tabs.home.title}</h2>
          <div class="vf-home-status">
            <div class="vf-home-status-dot"></div>
            <span class="vf-home-status-text">\${CONFIG.tabs.home.subtitle || 'We typically reply in minutes'}</span>
          </div>
        </div>
        
        <div class="vf-home-actions">
          \${CONFIG.tabs.home.buttons.filter(btn => btn.enabled).map((btn, idx) => \`
            <button class="vf-home-button" onclick="window.vfHandleHomeAction('\${btn.action}', '\${btn.phoneNumber || ''}')">
              <div class="vf-home-button-icon \${idx === 0 ? 'primary' : 'secondary'}">
                \${btn.action === 'call' ? icons.phone : icons.messageSquare}
              </div>
              <div class="vf-home-button-text">
                <strong>\${btn.text}</strong>
                <span>\${btn.action === 'call' ? 'Speak to a team member' : btn.action === 'new_chat' ? 'Chat with our AI assistant' : ''}</span>
              </div>
              <div class="vf-home-button-chevron">\${icons.chevronRight}</div>
            </button>
          \`).join('')}
        </div>
        
        \${CONFIG.poweredBy.enabled ? \`
          <div class="vf-powered-by">
            <span>Powered by \${CONFIG.poweredBy.text}</span>
          </div>
        \` : ''}
      </div>
    \`;
  }
  
  function renderChatHistory(container) {
    const history = SessionManager.getConversationHistory();
    
    if (history.length === 0) {
      container.innerHTML = \`
        <div class="vf-empty">
          \${icons.messageCircle}
          <p>No conversations yet</p>
          <p>Start a new chat to get going</p>
        </div>
      \`;
    } else {
      const recent = history[0];
      const older = history.slice(1);
      
      container.innerHTML = \`
        <div class="vf-chat-list">
          <div class="vf-chat-list-header">
            <span class="vf-chat-list-title">Chats</span>
          </div>
          <div style="padding: 0 16px 8px;">
            <button class="vf-new-chat-btn" onclick="window.vfStartNewChat()" style="margin:0;width:100%;">
              <span style="width:18px;height:18px;flex-shrink:0;display:inline-flex;">\${icons.plus}</span>
              <span style="font-size:14px;font-weight:500;">New Chat</span>
              <span style="margin-left:auto;color:inherit;opacity:0.3;">\${icons.chevronRight}</span>
            </button>
          </div>
          <div class="vf-chat-list-scroll">
            \${recent ? \`
              <div class="vf-chat-section-label">Continue recent conversation</div>
              <div class="vf-conv-card" onclick="window.vfLoadConversation('\${recent.id}')">
                <p class="vf-conv-card-preview">\${recent.preview}</p>
                <div class="vf-conv-card-meta">
                  \${icons.clock}
                  <span>\${formatTimeAgo(recent.timestamp)}</span>
                  <span class="vf-conv-card-count">\${recent.messageCount}</span>
                </div>
              </div>
            \` : ''}
            \${older.length > 0 ? \`
              <div class="vf-chat-section-label">Previous conversations</div>
              \${older.map(conv => \`
                <div class="vf-conv-card" onclick="window.vfLoadConversation('\${conv.id}')">
                  <p class="vf-conv-card-preview">\${conv.preview}</p>
                  <div class="vf-conv-card-meta">
                    \${icons.clock}
                    <span>\${formatTimeAgo(conv.timestamp)}</span>
                    <span class="vf-conv-card-count">\${conv.messageCount}</span>
                  </div>
                </div>
              \`).join('')}
            \` : ''}
          </div>
        </div>
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
  
  function startHandoverRealtime() {
    if (realtimeSubscription || !conversationId) return;
    
    console.log('[VF Widget] Starting handover realtime for:', conversationId);
    
    // Start from 3 seconds ago to catch the "Connecting you..." system message
    let lastTimestamp = new Date(Date.now() - 3000).toISOString();
    
    const pollInterval = setInterval(async () => {
      if (!isInHandover || !conversationId) {
        clearInterval(pollInterval);
        realtimeSubscription = null;
        return;
      }
      
      try {
        const url = SUPABASE_URL + '/rest/v1/transcripts?conversation_id=eq.' + conversationId 
          + '&timestamp=gt.' + encodeURIComponent(lastTimestamp) 
          + '&order=timestamp.asc'
          + '&select=id,speaker,text,buttons,timestamp,metadata';
        
        const response = await fetch(url, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          }
        });
        
        if (!response.ok) return;
        
        const newTranscripts = await response.json();
        
        if (newTranscripts.length > 0) {
          let hasNewMessages = false;
          
          for (const transcript of newTranscripts) {
            // Update cursor regardless of whether we display this message
            lastTimestamp = transcript.timestamp;
            
            // Skip user messages — the widget already shows those locally
            if (transcript.speaker === 'user') continue;
            
            // Only show client_user and system messages — assistant messages are handled separately
            const showMessage = 
              transcript.speaker === 'client_user' || 
              transcript.speaker === 'system';
            
            if (!showMessage) continue;
            
            // Skip pre-handover assistant messages (already shown locally from botResponses)
            if (transcript.metadata?.response_type === 'pre_handover') continue;
            
            // Deduplicate by transcript ID
            const rtId = 'rt_' + transcript.id;
            if (messages.some(m => m.id === rtId)) continue;
            
            const newMsg = {
              id: rtId,
              speaker: transcript.speaker === 'client_user' ? 'assistant' : transcript.speaker,
              text: transcript.text || '',
              buttons: transcript.buttons || null,
              timestamp: transcript.timestamp,
            };
            
            // Skip truly empty messages (no text AND no buttons)
            if ((!newMsg.text || !newMsg.text.trim()) && (!newMsg.buttons || !newMsg.buttons.length)) continue;
            
            messages.push(newMsg);
            hasNewMessages = true;
            
            // Detect handover end — stop polling after 3s to catch the system message
            if (transcript.metadata && transcript.metadata.type === 'handover_ended') {
              setTimeout(() => stopHandoverRealtime(), 3000);
            }
          }
          
          if (hasNewMessages) {
            isTyping = false;
            renderPanel();
            scrollToLatestMessage();
            if (conversationId) {
              SessionManager.saveConversation(conversationId, messages, currentVoiceflowSessionId, true);
            }
          }
        }
      } catch (e) {
        console.error('[VF Widget] Handover poll error:', e);
      }
    }, 1500);
    
    realtimeSubscription = pollInterval;
  }
  
  function stopHandoverRealtime() {
    if (realtimeSubscription) {
      console.log('[VF Widget] Stopping handover realtime');
      clearInterval(realtimeSubscription);
      realtimeSubscription = null;
    }
    isInHandover = false;
    isTyping = false;
    
    // One-time fetch for resume messages (Voiceflow bot responses after handover end)
    if (conversationId) {
      setTimeout(async () => {
        try {
          const url = SUPABASE_URL + '/rest/v1/transcripts?conversation_id=eq.' + conversationId 
            + '&speaker=eq.assistant'
            + '&order=timestamp.desc'
            + '&limit=5'
            + '&select=id,speaker,text,buttons,timestamp,metadata';
          
          const response = await fetch(url, {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            }
          });
          
          if (response.ok) {
            const transcripts = await response.json();
            let hasNew = false;
            
            // Process in chronological order (result is desc, reverse it)
            for (const t of transcripts.reverse()) {
              if (t.metadata?.response_type === 'handover_resume' || t.metadata?.response_type === 'handover_resume_buttons') {
                const rtId = 'rt_' + t.id;
                if (!messages.some(m => m.id === rtId)) {
                  let parsedButtons = null;
                  if (t.buttons) {
                    try {
                      parsedButtons = typeof t.buttons === 'string' ? JSON.parse(t.buttons) : t.buttons;
                    } catch(e) { parsedButtons = null; }
                  }
                  
                  messages.push({
                    id: rtId,
                    speaker: 'assistant',
                    text: t.text || '',
                    buttons: parsedButtons,
                    timestamp: t.timestamp,
                  });
                  hasNew = true;
                }
              }
            }
            
            if (hasNew) {
              renderPanel();
              scrollToLatestMessage();
              if (conversationId) {
                SessionManager.saveConversation(conversationId, messages, currentVoiceflowSessionId, true);
              }
            }
          }
        } catch (e) {
          console.error('[VF Widget] Error fetching resume messages:', e);
        }
      }, 500); // Fetch resume messages quickly after polling stops
    }
    
    renderPanel();
  }
  
  function renderMessages(container) {
    container.innerHTML = '<div class="vf-messages-wrap" id="vf-messages"></div>';
    const messagesEl = document.getElementById('vf-messages');
    
    messages.forEach(msg => {
      const isUser = msg.speaker === 'user';
      const isSystem = msg.speaker === 'system';
      const isAgent = msg.speaker === 'client_user';
      
      // Parse file URLs
      let messageContent = msg.text || '';
      let fileUrl = null;
      let fileName = null;
      let isImage = false;
      
      const fileMatch = messageContent.match(/\\[(Image|File): ([^\\]]+)\\]\\n(https?:\\/\\/[^\\s]+)/);
      if (fileMatch) {
        fileName = fileMatch[2];
        fileUrl = fileMatch[3];
        isImage = fileMatch[1] === 'Image' || /\\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
        messageContent = messageContent.replace(/\\[(Image|File): [^\\]]+\\]\\n[^\\s]+/, '').trim();
      }
      
      const wrapper = document.createElement('div');
      
      if (isSystem) {
        wrapper.className = 'vf-msg-system';
        wrapper.textContent = messageContent;
        messagesEl.appendChild(wrapper);
        return;
      }
      
      if (isUser) {
        wrapper.className = 'vf-msg-user-wrap';
        wrapper.innerHTML = \`
          <div class="vf-msg-user">
            \${messageContent ? messageContent : ''}
            \${fileUrl ? (isImage 
              ? \`<img src="\${fileUrl}" alt="\${fileName}" class="vf-file-preview" style="display:block;margin-top:6px;" />\`
              : \`<a href="\${fileUrl}" target="_blank" class="vf-file-link" style="color:rgba(255,255,255,0.8);">\${fileName}</a>\`
            ) : ''}
          </div>
        \`;
        messagesEl.appendChild(wrapper);
        return;
      }
      
      // Bot or agent message
      wrapper.style.cssText = 'display:flex;flex-direction:column;gap:0;';
      
      const isClicked = clickedButtonIds.has(msg.id);
      
      wrapper.innerHTML = \`
        \${isAgent ? \`
          <div class="vf-msg-agent">
            \${messageContent}
            \${fileUrl ? (isImage
              ? \`<img src="\${fileUrl}" alt="\${fileName}" class="vf-file-preview" />\`
              : \`<a href="\${fileUrl}" target="_blank" class="vf-file-link">\${fileName}</a>\`
            ) : ''}
          </div>
        \` : \`
          <p class="vf-msg-bot">
            \${messageContent}
            \${fileUrl ? (isImage
              ? \`<img src="\${fileUrl}" alt="\${fileName}" class="vf-file-preview" style="display:block;margin-top:6px;" />\`
              : \`<a href="\${fileUrl}" target="_blank" class="vf-file-link">\${fileName}</a>\`
            ) : ''}
          </p>
        \`}
        \${msg.buttons && msg.buttons.length > 0 ? \`
          <div class="vf-buttons">
            \${msg.buttons.map((btn, idx) => {
              const isSelected = clickedButtonSelections[msg.id] === idx;
              return \`
                <button 
                  class="vf-btn-option \${isSelected ? 'selected' : ''}" 
                  \${isClicked ? 'disabled' : ''}
                  onclick="window.vfHandleButtonClick('\${msg.id}', \${idx})"
                >\${btn.text}</button>
              \`;
            }).join('')}
          </div>
        \` : ''}
        <div class="vf-msg-time">\${formatTime(msg.timestamp)}</div>
      \`;
      
      messagesEl.appendChild(wrapper);
    });
    
    if (isTyping) {
      const typingDiv = document.createElement('div');
      typingDiv.innerHTML = \`
        <div class="vf-typing">
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
    const items = CONFIG.tabs.faq.items || [];
    
    if (items.length === 0) {
      container.innerHTML = \`
        <div class="vf-empty">
          <p>No FAQ items yet</p>
        </div>
      \`;
      return;
    }
    
    container.innerHTML = \`
      <div class="vf-faq-wrap">
        \${items.map((item, idx) => \`
          <div class="vf-faq-item">
            <button class="vf-faq-q" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open');">
              <span>\${item.question}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="vf-faq-a">\${item.answer}</div>
          </div>
        \`).join('')}
      </div>
    \`;
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
    if (!isInHandover) {
      isTyping = true;
    }
    renderPanel();
    scrollToLatestMessage();
    
    try {
      const response = await fetch(INTERACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: CONFIG.agentId,
          userId: getVoiceflowUserId(),
          baseUserId: userId,
          message: text,
          action: 'text',
          conversationId,
          isTestMode: CONFIG.isTestMode || false
        })
      });
      
      const data = await response.json();
      
      if (data.conversationId && data.conversationId !== conversationId) {
        console.log('[VF Widget] Conversation ID updated:', conversationId, '->', data.conversationId);
        conversationId = data.conversationId;
      }
      
      // Handle handover state
      if (data.handoverActive || data.handoverPending) {
        // Display any bot responses that came with this handover response
        // (e.g. "Let me connect you to our team" from Voiceflow, and "Connecting you..." as system pill)
        if (data.botResponses && data.botResponses.length > 0) {
          for (const resp of data.botResponses) {
            if (resp.text) {
              messages.push({
                id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                speaker: resp.type === 'system' ? 'system' : 'assistant',
                text: resp.text,
                buttons: resp.buttons || null,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
        isTyping = false;
        renderPanel();
        scrollToLatestMessage();
        if (!isInHandover) {
          isInHandover = true;
          startHandoverRealtime();
        }
        if (conversationId) {
          SessionManager.saveConversation(conversationId, messages, currentVoiceflowSessionId, true);
        }
        return;
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
      
      // Show conversation ended indicator
      if (data.conversationEnded) {
        isTyping = false;
        isConversationEnded = true;
        const endMsg = {
          id: 'msg_end_' + Date.now(),
          speaker: 'system',
          text: 'Conversation ended',
          timestamp: new Date().toISOString()
        };
        messages.push(endMsg);
        renderPanel();
        scrollToLatestMessage();
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
    stopHandoverRealtime();
    messages = [];
    conversationId = null;
    isConversationEnded = false;
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
          baseUserId: userId,
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
          baseUserId: userId,
          action: 'launch',
          conversationId: null,
          isTestMode: CONFIG.isTestMode || false
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
    if (!isInHandover) {
      isTyping = true;
    }
    renderPanel();
    
    try {
      const response = await fetch(INTERACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: CONFIG.agentId,
          userId: getVoiceflowUserId(),
          baseUserId: userId,
          message: JSON.stringify(button.payload),
          action: 'button',
          conversationId,
          isTestMode: CONFIG.isTestMode || false
        })
      });
      
      const data = await response.json();
      
      if (data.conversationId && data.conversationId !== conversationId) {
        console.log('[VF Widget] Conversation ID updated:', conversationId, '->', data.conversationId);
        conversationId = data.conversationId;
      }

      // Handle handover state
      if (data.handoverActive || data.handoverPending) {
        // Display Voiceflow bot responses that came before the handover action
        // (resp.type === 'system' renders as centred pill, others as bot bubble)
        if (data.botResponses && data.botResponses.length > 0) {
          for (const resp of data.botResponses) {
            if (resp.text) {
              messages.push({
                id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                speaker: resp.type === 'system' ? 'system' : 'assistant',
                text: resp.text,
                buttons: resp.buttons || null,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
        isTyping = false;
        renderPanel();
        scrollToLatestMessage();
        if (!isInHandover) {
          isInHandover = true;
          startHandoverRealtime();
        }
        if (conversationId) {
          SessionManager.saveConversation(conversationId, messages, currentVoiceflowSessionId, true);
        }
        return;
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
        }
      } else {
        isTyping = false;
        renderPanel();
      }
      
      // Show conversation ended indicator
      if (data.conversationEnded) {
        isTyping = false;
        isConversationEnded = true;
        const endMsg = {
          id: 'msg_end_' + Date.now(),
          speaker: 'system',
          text: 'Conversation ended',
          timestamp: new Date().toISOString()
        };
        messages.push(endMsg);
        renderPanel();
        scrollToLatestMessage();
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
  
  if (CONFIG.isEmbedded) {
    // Embedded mode: auto-open, no button, no welcome bubble
    isOpen = true;
    renderPanel();
  } else {
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
  }
  
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
