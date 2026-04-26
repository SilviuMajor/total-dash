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

    /* === FLOATING BUTTON (FAB) === */
    .vf-widget-button {
      position: fixed; bottom: 24px; right: 24px;
      width: 56px; height: 56px; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%;
      background: \${buttonColor};
      box-shadow: 0 12px 32px rgba(0,0,0,0.22), 0 4px 10px rgba(0,0,0,0.12);
      transition: transform 0.16s ease;
      z-index: 999998;
      padding: 0;
    }
    .vf-widget-button:hover { transform: scale(1.05); }
    .vf-widget-button:active { transform: scale(0.95); }
    .vf-widget-button.has-custom-icon { background: transparent; box-shadow: none; }
    .vf-widget-button.has-custom-icon img {
      width: 56px; height: 56px; border-radius: 50%; object-fit: cover;
      box-shadow: 0 12px 32px rgba(0,0,0,0.22), 0 4px 10px rgba(0,0,0,0.12);
    }
    .vf-widget-button .vf-btn-inner {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%; background: transparent;
    }
    .vf-widget-button.default-icon svg {
      width: 24px; height: 24px; color: #ffffff;
      stroke: currentColor; fill: none; stroke-width: 2;
    }

    /* === WELCOME BUBBLE (white with tail) === */
    .vf-welcome-bubble {
      position: fixed;
      bottom: 96px; right: 24px;
      max-width: 240px;
      padding: 9px 28px 9px 12px;
      background: #ffffff;
      border: 0.5px solid rgba(0,0,0,0.08);
      color: \${theme.textPrimary};
      border-radius: 14px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.08);
      font-family: \${CONFIG.appearance.fontFamily}, system-ui, sans-serif;
      font-size: 13px; line-height: 1.4;
      cursor: pointer;
      z-index: 999997;
      opacity: 0; transform: translateY(6px);
      transition: opacity 0.22s ease, transform 0.22s ease;
      pointer-events: none;
    }
    .vf-welcome-bubble.vf-visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
    .vf-welcome-bubble.vf-hidden { display: none !important; }
    .vf-welcome-bubble::after {
      content: '';
      position: absolute;
      bottom: -6px; right: 20px;
      width: 12px; height: 12px;
      background: #ffffff;
      border: 0.5px solid rgba(0,0,0,0.08);
      border-top: none; border-left: none;
      transform: rotate(45deg);
    }
    .vf-welcome-close {
      position: absolute; top: -6px; right: -6px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #ffffff; border: 0.5px solid rgba(0,0,0,0.1);
      color: \${theme.textMuted};
      font-size: 11px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      padding: 0;
    }
    .vf-welcome-close:hover { color: \${theme.textPrimary}; }

    /* === WIDGET PANEL (soft off-white canvas) === */
    .vf-widget-panel {
      position: fixed; bottom: 96px; right: 24px;
      width: 360px; max-width: calc(100vw - 48px);
      height: 580px; max-height: calc(100vh - 120px);
      background: \${theme.canvas};
      border-radius: 16px;
      border: 0.5px solid rgba(0,0,0,0.08);
      box-shadow: 0 12px 40px rgba(0,0,0,0.12);
      z-index: 999999;
      display: flex; flex-direction: column;
      font-family: \${CONFIG.appearance.fontFamily}, system-ui, sans-serif;
      overflow: hidden;
      transition: opacity 0.2s, transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .vf-widget-panel.hidden {
      opacity: 0; transform: translateY(6px) scale(0.98);
      pointer-events: none; visibility: hidden;
    }
    #vf-panel-content {
      flex: 1;
      display: flex; flex-direction: column;
      overflow: hidden; min-height: 0;
      padding: 0; box-sizing: border-box;
    }

    /* === DARK CARD (floating, shrinks from home to chat) === */
    .vf-dark-card {
      background: \${theme.dark};
      border-radius: 14px;
      margin: 10px 10px 0;
      padding: 12px 14px;
      flex-shrink: 0;
      display: flex; flex-direction: column;
      transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .vf-dark-card-home { min-height: 155px; }
    .vf-dark-card-chat {
      height: 44px; padding: 0 12px;
      flex-direction: row; align-items: center; gap: 10px;
    }
    .vf-dark-top {
      display: flex; justify-content: space-between; align-items: center;
    }
    .vf-dark-greeting-wrap { margin-top: auto; }
    .vf-dark-greeting {
      color: \${theme.darkText};
      font-size: 22px; font-weight: 500;
      letter-spacing: -0.015em; line-height: 1.15;
      margin: 0;
    }
    .vf-dark-status {
      display: flex; align-items: center; gap: 7px; margin-top: 10px;
    }
    .vf-dark-status-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: \${theme.statusOnline};
    }
    .vf-dark-status-text { font-size: 12px; color: \${theme.darkMuted}; }
    .vf-dark-back {
      color: rgba(255,255,255,0.75);
      background: transparent; border: none;
      padding: 0; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .vf-dark-back svg { width: 17px; height: 17px; stroke: currentColor; fill: none; stroke-width: 2; }
    .vf-dark-title {
      color: \${theme.darkText};
      font-size: 13px; font-weight: 500;
      margin: 0;
    }
    .vf-logo-badge {
      width: 26px; height: 26px; border-radius: 6px;
      background: #ffffff;
      color: \${accent};
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 500; letter-spacing: -0.02em;
      flex-shrink: 0; overflow: hidden;
    }
    .vf-logo-badge img { width: 100%; height: 100%; object-fit: cover; }
    /* Home card gets a larger, more prominent logo — proper brand moment */
    .vf-dark-card-home .vf-logo-badge {
      width: 34px; height: 34px; border-radius: 8px;
      font-size: 12px;
    }
    .vf-dark-close {
      width: 24px; height: 24px; border-radius: 50%;
      background: \${theme.darkInnerBg};
      color: \${theme.darkInnerFg};
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; padding: 0;
    }
    .vf-dark-close svg { width: 11px; height: 11px; stroke: currentColor; fill: none; stroke-width: 2.5; }
    .vf-dark-close:hover { background: rgba(255,255,255,0.15); }

    /* === HOME ACTIONS (pill cards with tinted icon square) === */
    .vf-home-actions {
      padding: 10px 14px 0;
      display: flex; flex-direction: column; gap: 8px;
      flex-shrink: 0;
    }
    .vf-home-action {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px;
      background: \${theme.surface};
      border: 0.5px solid \${theme.surfaceBorder};
      border-radius: 12px;
      cursor: pointer;
      color: \${theme.textPrimary};
      font-family: inherit; text-align: left;
      transition: background 0.15s ease;
    }
    .vf-home-action:hover { background: #FAFAFB; }
    .vf-home-action-icon {
      width: 34px; height: 34px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .vf-home-action-icon svg { width: 16px; height: 16px; }
    .vf-home-action-icon.primary { background: \${accentTintStrong}; color: \${accent}; }
    .vf-home-action-icon.secondary { background: #F0F0F2; color: #444; }
    .vf-home-action-text { flex: 1; min-width: 0; }
    .vf-home-action-label {
      font-size: 14px; font-weight: 500;
      color: \${theme.textPrimary}; line-height: 1.25;
    }
    .vf-home-action-sub {
      font-size: 12px; color: \${theme.textMuted};
      line-height: 1.25; margin-top: 2px;
    }
    .vf-home-action-chev { color: \${theme.textFaint}; display: flex; flex-shrink: 0; }
    .vf-home-action-chev svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2.5; }

    /* === CONTENT CONTAINER === */
    #vf-content {
      flex: 1;
      display: flex; flex-direction: column;
      overflow: hidden; min-height: 0;
    }

    /* === MESSAGES === */
    .vf-messages-wrap {
      flex: 1; overflow-y: auto;
      padding: 12px 14px 8px;
      display: flex; flex-direction: column; gap: 7px;
      scroll-behavior: smooth;
    }
    .vf-msg-bot {
      align-self: flex-start;
      max-width: 78%;
      padding: 9px 13px;
      background: \${theme.botBubble};
      border-radius: 16px; border-top-left-radius: 6px;
      font-size: 13px;
      color: \${theme.textPrimary};
      line-height: 1.45; margin: 0;
      word-wrap: break-word;
    }
    .vf-msg-bot img { max-width: 100%; height: auto; border-radius: 8px; margin-top: 6px; }
    .vf-msg-bot a { color: \${accent}; text-decoration: underline; }
    .vf-msg-user-wrap { display: flex; justify-content: flex-end; }
    .vf-msg-user {
      max-width: 78%;
      padding: 9px 13px;
      background: \${accent};
      color: #ffffff;
      border-radius: 16px; border-top-right-radius: 6px;
      font-size: 13px; line-height: 1.45; margin: 0;
      word-wrap: break-word;
    }
    .vf-msg-agent-wrap {
      align-self: flex-start;
      max-width: 85%;
      display: flex; flex-direction: column; gap: 0;
    }
    .vf-msg-agent-name {
      font-size: 9px; color: #666; font-weight: 500;
      margin: 0 0 2px 26px;
    }
    .vf-msg-agent-row {
      display: flex; align-items: flex-end; gap: 6px;
    }
    .vf-msg-agent-avatar {
      width: 20px; height: 20px; border-radius: 50%;
      background: \${theme.avatarBg};
      color: \${theme.avatarFg};
      display: flex; align-items: center; justify-content: center;
      font-size: 8px; font-weight: 500;
      flex-shrink: 0; margin-bottom: 2px;
    }
    .vf-msg-system {
      align-self: center;
      font-size: 11px;
      color: \${theme.textMuted};
      padding: 6px 0; text-align: center;
    }
    .vf-msg-time { display: none; }
    .vf-buttons {
      display: flex; flex-wrap: wrap; gap: 5px;
      align-self: flex-start; margin-top: 2px;
    }
    .vf-btn-option {
      padding: 7px 14px;
      border: 1px solid \${accent};
      border-radius: 999px;
      background: \${accentTint};
      color: \${accent};
      font-size: 12px; font-weight: 500;
      cursor: pointer; font-family: inherit; line-height: 1.3;
      transition: background 0.15s ease, opacity 0.15s ease;
    }
    .vf-btn-option:hover { background: \${accentTintStrong}; }
    /* Once a button has been clicked, all buttons in the group get disabled. */
    /* Non-selected ones fade to 35% opacity; the selected one fills and stays at 100%. */
    .vf-btn-option:disabled { opacity: 0.35; cursor: default; pointer-events: none; }
    .vf-btn-option.selected { background: \${accent}; color: #ffffff; border-color: \${accent}; }
    .vf-btn-option.selected:disabled { opacity: 0.7; }
    .vf-typing {
      align-self: flex-start;
      width: fit-content;
      padding: 10px 14px;
      background: \${theme.botBubble};
      border-radius: 16px; border-top-left-radius: 6px;
      display: inline-flex; gap: 4px; align-items: center;
    }
    .vf-typing-dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: #888;
      animation: vf-tbounce 1.4s infinite both;
    }
    .vf-typing-dot:nth-child(2) { animation-delay: 0.15s; }
    .vf-typing-dot:nth-child(3) { animation-delay: 0.3s; }
    @keyframes vf-tbounce {
      0%, 80%, 100% { opacity: 0.3; }
      40% { opacity: 1; }
    }

    /* === INPUT BAR === */
    .vf-input-bar {
      padding: 8px 10px;
      background: transparent;
      border-top: 0.5px solid \${theme.surfaceBorder};
      flex-shrink: 0;
    }
    .vf-input-row { display: flex; align-items: center; gap: 6px; }
    .vf-input-field {
      flex: 1; height: 34px;
      background: \${theme.surface};
      border: 0.5px solid #E0E0E4;
      border-radius: 999px;
      padding: 0 14px;
      font-size: 13px; color: \${theme.textPrimary};
      font-family: inherit; outline: none;
      transition: border-color 0.2s;
    }
    .vf-input-field::placeholder { color: #aaa; }
    .vf-input-field:focus { border-color: \${accent}; }
    .vf-attach-btn {
      width: 34px; height: 34px; border-radius: 50%;
      border: none; background: transparent;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: #888;
      flex-shrink: 0; padding: 0;
    }
    .vf-attach-btn:hover { color: \${theme.textSecondary}; }
    .vf-attach-btn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2; }
    .vf-send-btn {
      width: 34px; height: 34px; border-radius: 50%;
      border: none; background: \${accent};
      color: #ffffff;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; flex-shrink: 0; padding: 0;
      transition: opacity 0.2s;
    }
    .vf-send-btn:hover { opacity: 0.9; }
    .vf-send-btn svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; }

    /* === BOTTOM TABS === */
    .vf-tabs {
      border-top: 0.5px solid \${theme.divider};
      display: flex; justify-content: space-around; align-items: center;
      padding: 8px 0;
      background: \${theme.canvas};
      flex-shrink: 0;
      height: 44px;
    }
    .vf-tab {
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      padding: 4px 18px;
      cursor: pointer;
      border: none; background: transparent;
      font-family: inherit;
    }
    .vf-tab svg { width: 16px; height: 16px; }
    .vf-tab span { font-size: 10px; font-weight: 500; }
    .vf-tab.active { color: \${theme.dark}; }
    .vf-tab.active svg { fill: currentColor; stroke: currentColor; }
    .vf-tab:not(.active) { color: #a0a0a4; }
    .vf-tab:not(.active) svg { fill: none; stroke: currentColor; stroke-width: 2; }

    /* === CHATS TAB === */
    .vf-chat-list {
      flex: 1; overflow: hidden;
      display: flex; flex-direction: column;
      padding: 12px 12px 0;
    }
    .vf-new-chat-tinted {
      display: flex; align-items: center; gap: 10px;
      padding: 11px 14px;
      background: \${accentTint};
      color: \${accent};
      border-radius: 10px;
      border: none; cursor: pointer;
      font-family: inherit;
      font-size: 13px; font-weight: 500;
      margin-bottom: 10px;
      width: 100%; text-align: left;
    }
    .vf-new-chat-tinted svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; flex-shrink: 0; }
    .vf-new-chat-tinted:hover { background: \${accentTintStrong}; }
    .vf-chat-section-label {
      font-size: 11px; color: \${theme.textMuted};
      font-weight: 500;
      padding: 4px 2px 8px;
    }
    .vf-chat-list-scroll { flex: 1; overflow-y: auto; }
    .vf-conv-card {
      display: flex; align-items: center; gap: 11px;
      padding: 11px 12px;
      background: \${theme.surface};
      border: 0.5px solid \${theme.surfaceBorder};
      border-radius: 10px;
      margin-bottom: 6px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .vf-conv-card:hover { background: #FAFAFB; }
    .vf-conv-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: \${theme.avatarBg};
      color: \${theme.avatarFg};
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 500;
      flex-shrink: 0;
    }
    .vf-conv-avatar.bot { background: \${theme.botBubble}; color: #666; }
    .vf-conv-avatar.bot svg { width: 14px; height: 14px; }
    .vf-conv-middle { flex: 1; min-width: 0; }
    .vf-conv-preview {
      font-size: 13px;
      color: \${theme.textPrimary};
      line-height: 1.3; margin: 0;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .vf-conv-meta {
      font-size: 11px;
      color: \${theme.textMuted};
      line-height: 1.2; margin-top: 3px;
    }
    .vf-conv-right {
      display: flex; flex-direction: column; align-items: flex-end;
      gap: 4px; flex-shrink: 0;
    }
    .vf-conv-time { font-size: 11px; color: \${theme.textMuted}; }
    .vf-conv-unread {
      width: 18px; height: 18px; border-radius: 50%;
      background: \${accent}; color: #ffffff;
      font-size: 10px; font-weight: 500;
      display: flex; align-items: center; justify-content: center;
    }

    /* === FAQ TAB (pill-card accordion) === */
    .vf-faq-wrap {
      flex: 1; overflow-y: auto;
      padding: 12px 12px 0;
    }
    .vf-faq-item {
      background: \${theme.surface};
      border: 0.5px solid \${theme.surfaceBorder};
      border-radius: 10px;
      margin-bottom: 6px;
      overflow: hidden;
    }
    .vf-faq-q {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 12px 14px;
      cursor: pointer;
      border: none; background: transparent;
      font-family: inherit;
      font-size: 13px; font-weight: 500;
      color: \${theme.textPrimary};
      width: 100%; text-align: left;
      line-height: 1.35;
    }
    .vf-faq-q:hover { background: #FAFAFB; }
    .vf-faq-q svg {
      width: 13px; height: 13px;
      color: \${theme.textMuted};
      transition: transform 0.2s;
      flex-shrink: 0;
      stroke: currentColor; fill: none; stroke-width: 2.5;
    }
    .vf-faq-q.open svg { transform: rotate(180deg); }
    .vf-faq-a {
      padding: 12px 14px;
      border-top: 0.5px solid rgba(0,0,0,0.04);
      font-size: 12px; color: #555;
      line-height: 1.55; display: none;
    }
    .vf-faq-a.open { display: block; }

    /* === EMPTY STATES === */
    .vf-empty {
      flex: 1;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 20px; gap: 8px; text-align: center;
    }
    .vf-empty-icon {
      width: 44px; height: 44px; border-radius: 50%;
      background: \${theme.botBubble};
      color: #888;
      display: flex; align-items: center; justify-content: center;
    }
    .vf-empty-icon svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 2; }
    .vf-empty-title { font-size: 14px; font-weight: 500; color: \${theme.textPrimary}; }
    .vf-empty-sub { font-size: 12px; color: \${theme.textMuted}; line-height: 1.45; max-width: 200px; }
    .vf-empty-cta {
      margin-top: 6px;
      padding: 10px 18px;
      background: \${theme.dark}; color: #ffffff;
      border: none; border-radius: 999px;
      font-size: 12px; font-weight: 500;
      cursor: pointer; font-family: inherit;
    }

    /* === FILE PREVIEWS === */
    .vf-file-preview { max-width: 200px; height: auto; border-radius: 8px; margin-top: 4px; display: block; }
    .vf-file-link {
      color: \${accent}; font-size: 10.5px; text-decoration: underline;
      display: inline-block; margin-top: 4px;
    }

    /* === SCROLLBAR === */
    .vf-messages-wrap::-webkit-scrollbar,
    .vf-chat-list-scroll::-webkit-scrollbar,
    .vf-faq-wrap::-webkit-scrollbar { width: 4px; }
    .vf-messages-wrap::-webkit-scrollbar-thumb,
    .vf-chat-list-scroll::-webkit-scrollbar-thumb,
    .vf-faq-wrap::-webkit-scrollbar-thumb {
      background: rgba(0,0,0,0.15); border-radius: 4px;
    }
    .vf-messages-wrap::-webkit-scrollbar-track,
    .vf-chat-list-scroll::-webkit-scrollbar-track,
    .vf-faq-wrap::-webkit-scrollbar-track { background: transparent; }

    /* === MOBILE (< 640px) === */
    @media (max-width: 640px) {
      .vf-widget-panel {
        bottom: 0; right: 0; left: 0; top: 0;
        width: 100%; max-width: 100%;
        height: 100vh; max-height: 100vh;
        border-radius: 0;
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
      }
      .vf-dark-card { margin: 10px 12px 0; border-radius: 14px; }
      .vf-dark-card-home { min-height: 155px; }
      .vf-dark-card-chat { height: 46px; padding: 0 14px; }
      .vf-logo-badge { width: 26px; height: 26px; font-size: 9px; }
      .vf-dark-close { width: 26px; height: 26px; }
      .vf-dark-close svg { width: 12px; height: 12px; }
      .vf-home-action { padding: 12px 14px; }
      .vf-home-action-icon { width: 30px; height: 30px; }
      .vf-msg-bot, .vf-msg-user { font-size: 12px; padding: 8px 12px; }
      .vf-input-field { height: 32px; font-size: 11.5px; }
      .vf-attach-btn, .vf-send-btn { width: 32px; height: 32px; }
      .vf-tabs { height: 48px; padding: 6px 0 4px; }
      .vf-tab svg { width: 14px; height: 14px; }
      .vf-tab span { font-size: 9.5px; }
      .vf-welcome-bubble { right: 16px; bottom: 96px; max-width: 240px; }
    }

    /* === ATTACHMENT PREVIEW ROW (in input bar, replaces normal input while composing an attachment) === */
    .vf-attach-preview-row {
      background: \${theme.surface};
      border: 0.5px solid \${theme.surfaceBorder};
      border-radius: 12px;
      padding: 10px 12px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .vf-attach-preview-header {
      display: flex; align-items: center; gap: 10px;
    }
    .vf-attach-preview-thumb {
      width: 40px; height: 40px; border-radius: 8px;
      background: \${theme.botBubble};
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; overflow: hidden;
      color: #666;
    }
    .vf-attach-preview-thumb img {
      width: 100%; height: 100%; object-fit: cover;
    }
    .vf-attach-preview-thumb svg {
      width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 1.8;
    }
    .vf-attach-preview-meta {
      flex: 1; min-width: 0;
    }
    .vf-attach-preview-name {
      font-size: 12px; font-weight: 500;
      color: \${theme.textPrimary}; line-height: 1.2;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .vf-attach-preview-size {
      font-size: 10.5px; color: \${theme.textMuted};
      line-height: 1.2; margin-top: 2px;
    }
    .vf-attach-preview-close {
      width: 22px; height: 22px; border-radius: 50%;
      background: transparent; color: \${theme.textMuted};
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; padding: 0;
    }
    .vf-attach-preview-close:hover { background: \${theme.botBubble}; color: \${theme.textPrimary}; }
    .vf-attach-preview-close svg { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2; }
    .vf-attach-preview-caption {
      width: 100%;
      border: none; background: transparent;
      font-family: inherit; font-size: 12px;
      color: \${theme.textPrimary};
      outline: none;
      padding: 4px 0;
    }
    .vf-attach-preview-caption::placeholder { color: #aaa; }
    .vf-attach-preview-actions {
      display: flex; justify-content: flex-end; gap: 8px;
    }
    .vf-attach-preview-btn {
      padding: 6px 14px; border-radius: 999px;
      font-family: inherit; font-size: 11px; font-weight: 500;
      cursor: pointer; border: none;
      transition: background 0.15s ease, opacity 0.15s ease;
    }
    .vf-attach-preview-btn-cancel {
      background: transparent; color: \${theme.textMuted};
      border: 0.5px solid \${theme.surfaceBorder};
    }
    .vf-attach-preview-btn-cancel:hover { background: \${theme.botBubble}; color: \${theme.textPrimary}; }
    .vf-attach-preview-btn-send {
      background: \${accent}; color: #ffffff;
    }
    .vf-attach-preview-btn-send:hover { opacity: 0.9; }
    .vf-attach-preview-btn-send:disabled { opacity: 0.4; cursor: default; }
    .vf-attach-preview-progress-wrap {
      width: 100%; height: 4px; border-radius: 2px;
      background: \${theme.botBubble};
      overflow: hidden;
    }
    .vf-attach-preview-progress-bar {
      height: 100%; background: \${accent};
      transition: width 0.15s ease;
    }
    .vf-attach-preview-error {
      color: #ef4444; font-size: 11px; line-height: 1.35;
      display: flex; align-items: center; gap: 6px;
    }
    .vf-attach-preview-error svg {
      width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2;
      flex-shrink: 0;
    }

    /* === DROP ZONE OVERLAY (covers the whole panel when dragging a file over it) === */
    .vf-dropzone-overlay {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.35);
      display: none;
      align-items: center; justify-content: center;
      border-radius: 16px;
      z-index: 100;
      pointer-events: none;
    }
    .vf-dropzone-overlay.active { display: flex; }
    .vf-dropzone-inner {
      border: 2px dashed rgba(255,255,255,0.6);
      border-radius: 12px;
      padding: 24px 32px;
      color: #ffffff;
      text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 500;
    }
    .vf-dropzone-inner svg {
      width: 28px; height: 28px; stroke: currentColor; fill: none; stroke-width: 1.8;
    }
    .vf-dropzone-overlay.invalid .vf-dropzone-inner {
      border-color: #ef4444;
      color: #ef4444;
      background: rgba(239,68,68,0.15);
    }
    /* Panel needs position:relative for the absolute overlay to position correctly.
       The existing .vf-widget-panel is already position:fixed which is a valid
       containing block, so no extra rule needed here. */

    /* === ATTACHMENT RENDERING (in messages) === */
    .vf-msg-attach {
      margin: 4px 0 0;
      max-width: 240px;
    }
    .vf-msg-attach-image {
      max-width: 240px;
      max-height: 280px;
      border-radius: 12px;
      display: block;
      cursor: pointer;
      object-fit: cover;
    }
    .vf-msg-attach-video {
      max-width: 240px;
      max-height: 280px;
      border-radius: 12px;
      display: block;
      background: #000;
    }
    .vf-msg-attach-audio {
      width: 240px;
      height: 36px;
    }
    .vf-msg-attach-file {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 12px;
      background: \${theme.surface};
      border: 0.5px solid \${theme.surfaceBorder};
      text-decoration: none;
      color: \${theme.textPrimary};
      max-width: 240px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .vf-msg-attach-file:hover { background: #FAFAFB; }
    .vf-msg-attach-file-icon {
      width: 32px; height: 32px; border-radius: 8px;
      background: \${accentTint};
      color: \${accent};
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .vf-msg-attach-file-icon svg {
      width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 1.8;
    }
    .vf-msg-attach-file-meta {
      flex: 1; min-width: 0;
    }
    .vf-msg-attach-file-name {
      font-size: 12px; font-weight: 500;
      color: \${theme.textPrimary}; line-height: 1.25;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .vf-msg-attach-file-size {
      font-size: 10.5px; color: \${theme.textMuted};
      line-height: 1.2; margin-top: 2px;
    }
    .vf-msg-attach-file-dl {
      color: \${theme.textMuted};
      flex-shrink: 0;
    }
    .vf-msg-attach-file-dl svg {
      width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2;
    }

    /* When an attachment message has no text, the attachment sits flush with no gap-before */
    .vf-msg-attach-only { margin-top: 0; }

    /* === EMBEDDED MODE === */
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
  // N6: keep polling alive after handover_ended so we can detect a session_refreshed
  // event (agent took over after the prior session timed out). Cleared after the watch
  // window expires or once a refresh arrives.
  let postHandoverWatching = false;
  let pendingExitHandoverTimer = null;
  let postHandoverWatchTimer = null;
  const POST_HANDOVER_WATCH_MS = 30 * 60 * 1000;
  
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
  
  // FAB icon swap: show chat bubble when closed, × when open.
  // When the panel is open, the button acts as a close/minimize affordance, so we
  // override the custom chat-icon image (if any) with the × for the duration.
  function updateFabIcon() {
    if (!chatButton) return;
    const inner = chatButton.querySelector('.vf-btn-inner');
    if (!inner) return;
    
    if (isOpen) {
      chatButton.classList.remove('has-custom-icon');
      chatButton.classList.add('default-icon');
      inner.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    } else {
      if (hasCustomIcon) {
        chatButton.classList.remove('default-icon');
        chatButton.classList.add('has-custom-icon');
        inner.innerHTML = \`<img src="\${CONFIG.appearance.chatIconUrl}" alt="Chat" />\`;
      } else {
        chatButton.classList.remove('has-custom-icon');
        chatButton.classList.add('default-icon');
        inner.innerHTML = icons.messageSquare;
      }
    }
  }
  
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
  //
  // Panel shell: the dark card sits at the top of the canvas with 10px margin.
  // On home, the card is tall and holds logo + close + greeting + status inside it.
  // On chat/chats/FAQ, the card shrinks to a 38px header holding back + logo + title + close.
  // No separate vf-header bar. No accent stripe.
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
    
    // Title shown in the shrunk dark card when not on home
    let cardTitle = 'Chat';
    if (currentTab === 'Chats' && !isInActiveChat) cardTitle = 'Chats';
    else if (currentTab === 'FAQ') cardTitle = 'FAQ';
    else if (isInActiveChat) cardTitle = 'Chat';
    
    // Logo HTML — image if configured, otherwise agent initial
    const logoInner = CONFIG.appearance.logoUrl
      ? \`<img src="\${CONFIG.appearance.logoUrl}" alt="Logo" />\`
      : (CONFIG.agentName || '?').charAt(0).toUpperCase();
    
    // On home, the dark card content is rendered by renderHome() into a placeholder.
    // On other screens, the dark card is a slim header rendered inline here.
    const darkCardHtml = isHome
      ? \`
        <div class="vf-dark-card vf-dark-card-home" id="vf-dark-card">
          <!-- Content injected by renderHome -->
        </div>
      \`
      : \`
        <div class="vf-dark-card vf-dark-card-chat" id="vf-dark-card">
          \${showBackButton ? \`
            <button class="vf-dark-back" onclick="window.vfGoBack()" aria-label="Back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            </button>
          \` : ''}
          <div class="vf-logo-badge">\${logoInner}</div>
          <p class="vf-dark-title">\${cardTitle}</p>
          <div style="flex:1;"></div>
          <button class="vf-dark-close" onclick="window.vfCloseWidget()" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      \`;
    
    panelContent.innerHTML = \`
      \${darkCardHtml}
      <div id="vf-content"></div>
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
                <button class="vf-attach-btn" onclick="window.vfAttachFile()" aria-label="Attach file">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </button>
              \` : ''}
              <input type="text" class="vf-input-field" id="vf-input" placeholder="Type a message..." />
              <button class="vf-send-btn" onclick="window.vfSendMessage()" aria-label="Send">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>
              </button>
            </div>
          \`}
        </div>
      \` : ''}
      \${showTabs && tabs.length > 1 ? \`
        <div class="vf-tabs">
          \${tabs.map(tab => {
            const iconSvg = tab === 'Home'
              ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>'
              : tab === 'FAQ'
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
            return \`
              <button class="vf-tab \${tab === currentTab ? 'active' : ''}" onclick="window.vfSwitchTab('\${tab}')">
                \${iconSvg}
                <span>\${tab}</span>
              </button>
            \`;
          }).join('')}
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
    // Fill the dark card (rendered by renderPanel as an empty placeholder on home).
    // Logo + close go in the top row. Greeting + status sit at the bottom.
    const darkCard = document.getElementById('vf-dark-card');
    if (darkCard) {
      const logoInner = CONFIG.appearance.logoUrl
        ? \`<img src="\${CONFIG.appearance.logoUrl}" alt="Logo" />\`
        : (CONFIG.agentName || '?').charAt(0).toUpperCase();
      
      darkCard.innerHTML = \`
        <div class="vf-dark-top">
          <div class="vf-logo-badge">\${logoInner}</div>
          <button class="vf-dark-close" onclick="window.vfCloseWidget()" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="vf-dark-greeting-wrap">
          <h2 class="vf-dark-greeting">\${CONFIG.tabs.home.title}</h2>
          <div class="vf-dark-status">
            <div class="vf-dark-status-dot"></div>
            <span class="vf-dark-status-text">\${CONFIG.tabs.home.subtitle || 'Team online now'}</span>
          </div>
        </div>
      \`;
    }
    
    // Action pill cards — first enabled button gets the primary (brand-tinted) icon square.
    // Subsequent buttons get the neutral grey icon square.
    const enabledButtons = CONFIG.tabs.home.buttons.filter(btn => btn.enabled);
    
    const actionIconSvg = (action) => {
      if (action === 'call') {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4 12.8 12.8 0 0 0 2.8.7A2 2 0 0 1 22 16.9z"></path></svg>';
      }
      // Default: speech bubble
      return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5 8.5 8.5 0 0 1 8.5 8.5z"></path></svg>';
    };
    
    const actionSubtitle = (action) => {
      if (action === 'call') return 'Speak to a team member';
      if (action === 'new_chat') return 'Chat with our AI assistant';
      return '';
    };
    
    container.innerHTML = \`
      <div class="vf-home-actions">
        \${enabledButtons.map((btn, idx) => \`
          <button class="vf-home-action" onclick="window.vfHandleHomeAction('\${btn.action}', '\${btn.phoneNumber || ''}')">
            <div class="vf-home-action-icon \${idx === 0 ? 'primary' : 'secondary'}">
              \${actionIconSvg(btn.action)}
            </div>
            <div class="vf-home-action-text">
              <div class="vf-home-action-label">\${btn.text}</div>
              \${actionSubtitle(btn.action) ? \`<div class="vf-home-action-sub">\${actionSubtitle(btn.action)}</div>\` : ''}
            </div>
            <div class="vf-home-action-chev">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </button>
        \`).join('')}
      </div>
    \`;
  }
  
  function renderChatHistory(container) {
    const history = SessionManager.getConversationHistory();
    
    // Empty state — first-time user or no prior conversations
    if (history.length === 0) {
      container.innerHTML = \`
        <div class="vf-empty">
          <div class="vf-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="vf-empty-title">No conversations yet</div>
          <div class="vf-empty-sub">Start a new chat and we'll remember it here for next time.</div>
          <button class="vf-empty-cta" onclick="window.vfStartNewChat()">New chat</button>
        </div>
      \`;
      return;
    }
    
    // Populated list — tinted CTA + section label + conversation pill cards
    const recent = history[0];
    const older = history.slice(1);
    
    // Build a single card's HTML — avatar + preview + meta + time (+ unread badge if applicable).
    // Avatar: if a human agent took over during this conversation and their name was stored,
    // show their initials. Otherwise show the generic bot icon.
    const convCardHtml = (conv) => {
      let avatarHtml = \`
        <div class="vf-conv-avatar bot">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5 8.5 8.5 0 0 1 8.5 8.5z"/></svg>
        </div>
      \`;
      
      const lastAgentMsg = (conv.messages || []).slice().reverse().find(m => m.speaker === 'client_user');
      if (lastAgentMsg && lastAgentMsg.agentName) {
        const initials = lastAgentMsg.agentName.trim().split(/\\s+/).map(w => w.charAt(0).toUpperCase()).slice(0, 2).join('');
        avatarHtml = \`<div class="vf-conv-avatar">\${initials || '?'}</div>\`;
      }
      
      const unread = conv.unreadCount || 0;
      const unreadHtml = unread > 0
        ? \`<div class="vf-conv-unread">\${unread}</div>\`
        : '';
      
      const safePreview = (conv.preview || 'New conversation')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      return \`
        <div class="vf-conv-card" onclick="window.vfLoadConversation('\${conv.id}')">
          \${avatarHtml}
          <div class="vf-conv-middle">
            <div class="vf-conv-preview">\${safePreview}</div>
            <div class="vf-conv-meta">\${conv.messageCount || 0} messages</div>
          </div>
          <div class="vf-conv-right">
            <div class="vf-conv-time">\${formatTimeAgo(conv.timestamp)}</div>
            \${unreadHtml}
          </div>
        </div>
      \`;
    };
    
    container.innerHTML = \`
      <div class="vf-chat-list">
        <button class="vf-new-chat-tinted" onclick="window.vfStartNewChat()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          <span>New chat</span>
        </button>
        <div class="vf-chat-section-label">Recent</div>
        <div class="vf-chat-list-scroll">
          \${recent ? convCardHtml(recent) : ''}
          \${older.map(convCardHtml).join('')}
        </div>
      </div>
    \`;
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
      // N6: keep polling while in handover OR while watching for a session_refreshed
      // event after handover_ended (within POST_HANDOVER_WATCH_MS).
      if ((!isInHandover && !postHandoverWatching) || !conversationId) {
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
            
            // Detect handover end — exit handover UI after 3s, but keep polling for
            // POST_HANDOVER_WATCH_MS so we can pick up a session_refreshed event if an
            // agent takes over post-timeout.
            if (transcript.metadata && transcript.metadata.type === 'handover_ended') {
              if (pendingExitHandoverTimer) clearTimeout(pendingExitHandoverTimer);
              pendingExitHandoverTimer = setTimeout(function() {
                exitHandoverUI();
              }, 3000);
              postHandoverWatching = true;
              if (postHandoverWatchTimer) clearTimeout(postHandoverWatchTimer);
              postHandoverWatchTimer = setTimeout(function() {
                postHandoverWatching = false;
                postHandoverWatchTimer = null;
              }, POST_HANDOVER_WATCH_MS);
            }

            // N6: agent took over after the prior session ended. Cancel the pending
            // exit-UI timer (if still scheduled), drop watch mode, and re-enter handover.
            if (transcript.metadata && transcript.metadata.type === 'session_refreshed') {
              if (pendingExitHandoverTimer) {
                clearTimeout(pendingExitHandoverTimer);
                pendingExitHandoverTimer = null;
              }
              if (postHandoverWatchTimer) {
                clearTimeout(postHandoverWatchTimer);
                postHandoverWatchTimer = null;
              }
              postHandoverWatching = false;
              if (!isInHandover) {
                isInHandover = true;
                console.log('[VF Widget] Handover resumed by takeover');
              }
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
  
  // N6: exit the handover UI but keep polling alive in case a takeover refresh arrives.
  // Called 3s after handover_ended. Used to be the body of stopHandoverRealtime.
  function exitHandoverUI() {
    pendingExitHandoverTimer = null;
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
      }, 500);
    }

    renderPanel();
  }

  // Hard stop — used by startNewChat. Tears down polling and clears all state.
  function stopHandoverRealtime() {
    if (realtimeSubscription) {
      console.log('[VF Widget] Stopping handover realtime');
      clearInterval(realtimeSubscription);
      realtimeSubscription = null;
    }
    if (pendingExitHandoverTimer) {
      clearTimeout(pendingExitHandoverTimer);
      pendingExitHandoverTimer = null;
    }
    if (postHandoverWatchTimer) {
      clearTimeout(postHandoverWatchTimer);
      postHandoverWatchTimer = null;
    }
    postHandoverWatching = false;
    isInHandover = false;
    isTyping = false;
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
      
      // Bot message — grey bubble ONLY if there's text or a file.
      // When Voiceflow sends { text: '', buttons: [...] } we must skip the
      // empty <p class="vf-msg-bot"> or it renders as an empty grey bubble
      // above the buttons. That was the "empty bubble before buttons" bug.
      const isClicked = clickedButtonIds.has(msg.id);
      wrapper.style.cssText = 'display:flex;flex-direction:column;gap:5px;align-self:flex-start;max-width:100%;';
      
      const hasBotBody = (messageContent && messageContent.trim()) || fileUrl;
      
      wrapper.innerHTML = \`
        \${isAgent ? \`
          <div class="vf-msg-agent">
            \${messageContent}
            \${fileUrl ? (isImage
              ? \`<img src="\${fileUrl}" alt="\${fileName}" class="vf-file-preview" />\`
              : \`<a href="\${fileUrl}" target="_blank" class="vf-file-link">\${fileName}</a>\`
            ) : ''}
          </div>
        \` : (hasBotBody ? \`
          <p class="vf-msg-bot">
            \${messageContent}
            \${fileUrl ? (isImage
              ? \`<img src="\${fileUrl}" alt="\${fileName}" class="vf-file-preview" style="display:block;margin-top:6px;" />\`
              : \`<a href="\${fileUrl}" target="_blank" class="vf-file-link">\${fileName}</a>\`
            ) : ''}
          </p>
        \` : '')}
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
    
    // Typing indicator — append .vf-typing directly (no outer wrapper div).
    // The old code wrapped it in a plain <div> which became a block-level
    // flex child, stretched to full width, and ignored align-self:flex-start.
    // That was the "typing stretches across full width" bug.
    if (isTyping) {
      const typingEl = document.createElement('div');
      typingEl.className = 'vf-typing';
      typingEl.innerHTML = \`
        <div class="vf-typing-dot"></div>
        <div class="vf-typing-dot"></div>
        <div class="vf-typing-dot"></div>
      \`;
      messagesEl.appendChild(typingEl);
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
    updateFabIcon();
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
      updateFabIcon();
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
      updateFabIcon();
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
