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
      
      // Compute preview: prefer the last message's text; if empty but the
      // message has attachments, render an emoji + filename instead so the
      // chat-history list shows something meaningful for image/file-only sends.
      let preview = 'New conversation';
      if (messages.length > 0) {
        const last = messages[messages.length - 1];
        if (last.text && last.text.trim()) {
          preview = last.text.substring(0, 60);
        } else if (Array.isArray(last.attachments) && last.attachments.length > 0) {
          const att = last.attachments[0];
          const emoji = att.kind === 'image' ? '📷'
            : att.kind === 'video' ? '🎥'
            : att.kind === 'audio' ? '🎤'
            : '📎';
          preview = emoji + ' ' + (att.fileName || 'Attachment');
        }
      }

      const conversation = {
        id: conversationId,
        messages,
        timestamp: new Date().toISOString(),
        preview,
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
    .vf-msg-bot-wrap { display: flex; flex-direction: column; gap: 5px; }
    .vf-msg-user-wrap { display: flex; justify-content: flex-end; }
    .vf-msg-user {
      padding: 9px 13px;
      background: \${accent};
      color: #ffffff;
      border-radius: 16px; border-top-right-radius: 6px;
      font-size: 13px; line-height: 1.45; margin: 0;
      word-wrap: break-word;
    }
    .vf-msg-body {
      position: relative;
      max-width: 78%;
      display: flex; flex-direction: column; gap: 5px;
    }
    .vf-msg-bot-wrap .vf-msg-body { align-self: flex-start; align-items: flex-start; }
    .vf-msg-user-wrap .vf-msg-body { align-items: flex-end; }
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
    .vf-msg-time {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      white-space: nowrap;
      font-size: 11px;
      color: \${theme.textMuted};
      opacity: 0;
      transition: opacity 0.15s ease;
      pointer-events: none;
    }
    .vf-msg-user-wrap .vf-msg-time { right: 100%; margin-right: 8px; }
    .vf-msg-bot-wrap .vf-msg-time { left: 100%; margin-left: 8px; }
    [data-msg-id]:hover .vf-msg-time { opacity: 1; }
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

    /* === POWERED BY BADGE (home only) === */
    /* margin-top:auto pushes the badge to the bottom of #vf-content (which is
       a flex column), so it sits flush above the tab nav regardless of how
       tall the action pills above it are. */
    .vf-powered-by {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 10px 12px 14px;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: \${theme.textMuted};
      flex-shrink: 0;
      margin-top: auto;
    }
    .vf-powered-by .vf-powered-mark {
      color: \${theme.textPrimary};
      font-weight: 700;
    }

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

    /* === MOBILE — STANDARD (<= 640px): modern phones === */
    @media (max-width: 640px) {
      .vf-widget-button { width: 68px; height: 68px; }
      .vf-widget-button.has-custom-icon img { width: 68px; height: 68px; }
      .vf-widget-button.default-icon svg { width: 29px; height: 29px; }

      .vf-widget-panel {
        bottom: 0; right: 0; left: 0; top: 0;
        width: 100%; max-width: 100%;
        height: 100vh; max-height: 100vh;
        height: 100dvh; max-height: 100dvh;
        border-radius: 0;
        box-sizing: border-box;
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
      }
      .vf-dark-card { margin: 12px 14px 0; border-radius: 16px; padding: 14px 16px; }
      .vf-dark-card-home { min-height: 40vh; }
      .vf-dark-card-chat { height: 52px; padding: 0 16px; }
      .vf-dark-greeting { font-size: 28px; line-height: 1.2; }
      .vf-dark-status { font-size: 13px; }
      .vf-dark-status-dot { width: 8px; height: 8px; }
      .vf-dark-status-text { font-size: 13px; }
      .vf-dark-title { font-size: 15px; }
      .vf-logo-badge { width: 30px; height: 30px; font-size: 11px; }
      .vf-dark-close { width: 30px; height: 30px; }
      .vf-dark-close svg { width: 14px; height: 14px; }
      .vf-dark-back { width: 30px; height: 30px; }
      .vf-dark-back svg { width: 16px; height: 16px; }

      .vf-home-actions { padding: 14px 16px 0; gap: 10px; }
      .vf-home-action { padding: 14px 16px; gap: 14px; }
      .vf-home-action-icon { width: 40px; height: 40px; border-radius: 10px; }
      .vf-home-action-icon svg { width: 20px; height: 20px; }
      .vf-home-action-label { font-size: 16px; }
      .vf-home-action-sub { font-size: 13.5px; }
      .vf-home-action-chev svg { width: 16px; height: 16px; }

      .vf-msg-bot, .vf-msg-user { font-size: 16px; padding: 11px 15px; line-height: 1.4; }
      .vf-input-field { height: 44px; font-size: 16px; padding: 0 16px; }
      .vf-attach-btn, .vf-send-btn { width: 44px; height: 44px; }
      .vf-attach-btn svg { width: 22px; height: 22px; }
      .vf-send-btn svg { width: 18px; height: 18px; }

      .vf-tabs { height: 60px; padding: 8px 0 6px; }
      .vf-tab svg { width: 20px; height: 20px; }
      .vf-tab span { font-size: 12px; letter-spacing: 0.1px; }

      .vf-chat-list { padding: 14px 14px 0; }
      .vf-conv-card { padding: 12px 14px; }

      .vf-welcome-bubble { right: 16px; bottom: 96px; max-width: calc(100vw - 80px); }
    }

    /* === MOBILE — SMALL (<= 380px): iPhone SE / mini / small Android === */
    @media (max-width: 380px) {
      .vf-dark-card { margin: 10px 10px 0; padding: 12px 14px; }
      .vf-dark-card-home { min-height: 34vh; }
      .vf-dark-card-chat { height: 48px; padding: 0 14px; }
      .vf-dark-greeting { font-size: 24px; }
      .vf-dark-status, .vf-dark-status-text { font-size: 12px; }
      .vf-dark-status-dot { width: 7px; height: 7px; }
      .vf-dark-title { font-size: 14px; }
      .vf-logo-badge { width: 28px; height: 28px; font-size: 10px; }
      .vf-dark-close { width: 28px; height: 28px; }
      .vf-dark-close svg { width: 13px; height: 13px; }
      .vf-dark-back { width: 28px; height: 28px; }
      .vf-dark-back svg { width: 15px; height: 15px; }

      .vf-home-actions { padding: 12px 12px 0; gap: 8px; }
      .vf-home-action { padding: 12px 14px; gap: 12px; }
      .vf-home-action-icon { width: 36px; height: 36px; border-radius: 9px; }
      .vf-home-action-icon svg { width: 18px; height: 18px; }
      .vf-home-action-label { font-size: 14px; }
      .vf-home-action-sub { font-size: 12.5px; }

      .vf-msg-bot, .vf-msg-user { font-size: 15px; padding: 10px 13px; line-height: 1.4; }
      .vf-input-field { height: 40px; font-size: 16px; padding: 0 14px; }
      .vf-attach-btn, .vf-send-btn { width: 40px; height: 40px; }
      .vf-attach-btn svg { width: 19px; height: 19px; }
      .vf-send-btn svg { width: 15px; height: 15px; }

      .vf-tabs { height: 56px; padding: 6px 0 4px; }
      .vf-tab svg { width: 18px; height: 18px; }
      .vf-tab span { font-size: 11px; }

      .vf-chat-list { padding: 12px 12px 0; }
    }

    /* === ATTACHMENT PREVIEW ROW (in input bar, replaces normal input while composing an attachment) === */
    /* Preview row: horizontal strip of square tiles above the input bar.
       One tile per pending upload — thumbnail only, no filename, no size. */
    .vf-attach-preview-row {
      display: flex; flex-wrap: wrap; gap: 8px;
      /* Top padding kept >=4px so the \u00d7 close button (positioned at top:-4px on the
         tile) doesn't get clipped by the row's bounding box. Bottom padding keeps
         the tile from sitting flush against the text input below. */
      padding: 6px 12px 8px;
    }
    .vf-attach-tile {
      position: relative;
      width: 56px; height: 56px;
      border-radius: 10px;
      background: \${theme.botBubble};
      /* Intentionally NO overflow:hidden here \u2014 the close button overlays the
         tile at top:-4px / right:-4px and would be clipped otherwise. The
         thumbnail child has its own overflow:hidden + border-radius so the
         image still gets clean rounded corners. */
      flex-shrink: 0;
      color: #666;
      display: flex; align-items: center; justify-content: center;
    }
    .vf-attach-tile-thumb {
      width: 100%; height: 100%;
      border-radius: 10px;
      overflow: hidden;
      display: flex; align-items: center; justify-content: center;
    }
    .vf-attach-tile-thumb img {
      width: 100%; height: 100%; object-fit: cover; display: block;
    }
    .vf-attach-tile-thumb svg {
      width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 1.8;
    }
    .vf-attach-tile-close {
      position: absolute; top: -4px; right: -4px;
      width: 18px; height: 18px; border-radius: 50%;
      background: \${theme.dark}; color: #ffffff;
      border: 1.5px solid \${theme.canvas};
      cursor: pointer; padding: 0;
      display: flex; align-items: center; justify-content: center;
      z-index: 2;
    }
    .vf-attach-tile-close svg {
      width: 9px; height: 9px; stroke: currentColor; fill: none; stroke-width: 2.5;
    }
    .vf-attach-tile-close:hover { opacity: 0.85; }
    /* Per-tile progress bar overlays the bottom edge while uploading */
    .vf-attach-tile-progress {
      position: absolute; left: 0; right: 0; bottom: 0;
      height: 3px; background: rgba(0,0,0,0.15);
      z-index: 1;
    }
    .vf-attach-tile-progress-bar {
      height: 100%; background: \${accent};
      width: 0%;
      transition: width 0.15s ease;
    }
    /* Error state — red retry overlay */
    .vf-attach-tile-error {
      position: absolute; inset: 0;
      background: rgba(239,68,68,0.9);
      color: #ffffff;
      border: none; padding: 0; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      z-index: 1;
    }
    .vf-attach-tile-error svg {
      width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2;
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
  // Pre-handover watch: keep the transcript poll alive during the AI portion of a
  // conversation so we can detect an agent doing "take over conversation" early
  // (before the user requested human help). Without this, the system message
  // "Now speaking with X" inserted by handover-actions never reaches the widget
  // because the poll only ran while isInHandover=true.
  // Anon RLS on transcripts opens up automatically once the takeover creates an
  // active handover_session, so the poll succeeds at that point.
  let preHandoverWatching = false;

  // Phase 2: attachment composer state. Two-phase: pick fires a STAGE upload
  // (storage only) immediately; the tile shows progress and lands in 'ready'
  // state. The transcript is only written when the user presses Send — the
  // ready entries get committed via widget-file-upload (with stagedAttachment),
  // and the caption (if any) attaches to the FIRST file's bubble.
  // Paperclip + drag-and-drop gated on isInHandover. Stage uploads serialise so
  // per-file transcript timestamps preserve pick order on the dashboard.
  let uploadQueue = [];          // [{ id, file, kind, previewUrl, status, progress, error, staged }]
  let activeUploadXhr = null;
  let isCommittingSend = false;  // true while Send is committing staged entries
  let isDragging = false;
  let dragInvalid = false;
  // We previously used a dragCounter to track nested enter/leave but it
  // drifts: dragend can fire outside the panel without a matching dragleave,
  // and Safari sometimes coalesces events when the cursor crosses children
  // quickly. Using e.relatedTarget + a window-level reset is more reliable.
  const MAX_BATCH_FILES = 5;
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg','image/png','image/gif','image/webp',
    'video/mp4','video/webm','video/quicktime',
    'audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/x-m4a',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain','text/csv',
    'application/zip',
  ]);
  
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

  // Phase 2 Step B: dropzone overlay for drag-and-drop. Inserted once; toggled via classes.
  if (chatPanel) {
    const dropzone = document.createElement('div');
    dropzone.className = 'vf-dropzone-overlay';
    dropzone.id = 'vf-dropzone';
    dropzone.innerHTML = '<div class="vf-dropzone-inner">'
      + '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
      + '<span id="vf-dropzone-label">Drop to attach</span>'
      + '</div>';
    chatPanel.appendChild(dropzone);
    attachDragDropHandlers(chatPanel);
  }
  
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
      ensurePreHandoverWatch();
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
            <div id="vf-attach-preview-host"></div>
            <div class="vf-input-row">
              \${CONFIG.functions.fileUploadEnabled && isInHandover ? \`
                <input type="file" id="vf-file-input" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/zip" style="display:none;" multiple />
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
      fileInput.addEventListener('change', (e) => {
        handlePickedFiles(e.target.files);
        // Reset so picking the same file twice in a row still fires change.
        e.target.value = '';
      });
    }

    renderAttachPreview();
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

  // Soft refresh: only rebuild the messages list, leave the input bar alone.
  // The iOS keyboard is bound to the focused input element — destroying that
  // element (which renderPanel does) dismisses the keyboard. As long as we're
  // in an active chat and the layout hasn't changed (no end-of-conversation
  // swap), we can update messages without touching the input.
  function refreshChatMessages() {
    const inputEl = document.getElementById('vf-input');
    if (isInActiveChat && !isConversationEnded && inputEl) {
      renderContent();
      return;
    }
    renderPanel();
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
      \${renderPoweredByHtml()}
    \`;
  }

  // Powered-by badge — sits above the tab bar on the Home tab and at the bottom
  // of Chats list. Off if the agency disables it via widget settings.
  function renderPoweredByHtml() {
    if (!CONFIG.poweredBy || !CONFIG.poweredBy.enabled) return '';
    const text = (CONFIG.poweredBy.text || 'TotalDash').toString();
    return '<div class="vf-powered-by">Powered by <span class="vf-powered-mark">' + escapeHtml(text) + '</span></div>';
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
  
  // Begin watching transcripts during the AI portion of a conversation so we
  // can detect an agent doing "take over conversation" before the user ever
  // requested human help. No-op if a handover poll is already running, or if
  // we're already in handover (the regular poll covers it).
  function ensurePreHandoverWatch() {
    if (!conversationId) return;
    if (isInHandover || preHandoverWatching) return;
    preHandoverWatching = true;
    startHandoverRealtime();
  }

  function startHandoverRealtime() {
    if (realtimeSubscription || !conversationId) return;
    
    console.log('[VF Widget] Starting handover realtime for:', conversationId);
    
    // Start from 3 seconds ago to catch the "Connecting you..." system message
    let lastTimestamp = new Date(Date.now() - 3000).toISOString();
    
    const pollInterval = setInterval(async () => {
      // Keep polling while:
      //   - in handover (live transcript stream), OR
      //   - watching for a session_refreshed event after handover_ended (N6), OR
      //   - watching for an early agent takeover during the AI portion (preHandover).
      if ((!isInHandover && !postHandoverWatching && !preHandoverWatching) || !conversationId) {
        clearInterval(pollInterval);
        realtimeSubscription = null;
        return;
      }
      
      try {
        const url = SUPABASE_URL + '/rest/v1/transcripts?conversation_id=eq.' + conversationId
          + '&timestamp=gt.' + encodeURIComponent(lastTimestamp)
          + '&order=timestamp.asc'
          + '&select=id,speaker,text,buttons,timestamp,metadata,attachments';
        
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
              attachments: Array.isArray(transcript.attachments) ? transcript.attachments : null,
              timestamp: transcript.timestamp,
            };

            // Skip truly empty messages (no text AND no buttons AND no attachments)
            if (
              (!newMsg.text || !newMsg.text.trim())
              && (!newMsg.buttons || !newMsg.buttons.length)
              && (!newMsg.attachments || !newMsg.attachments.length)
            ) continue;
            
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

            // Early takeover: agent clicked "Take Over Conversation" while the user
            // was still mid-AI-flow (no prior handover request). The handover_accepted
            // system message arrives via this poll because preHandoverWatching kept
            // it alive. Flip into the handover UI so the paperclip appears, the
            // input bar is rebuilt, and the realtime stream takes over from here.
            if (
              transcript.metadata && transcript.metadata.type === 'handover_accepted' &&
              !isInHandover
            ) {
              isInHandover = true;
              preHandoverWatching = false;
              console.log('[VF Widget] Handover started by agent takeover');
              renderPanel();
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
                // Re-render the panel so the paperclip + drag-drop come back.
                // refreshChatMessages alone doesn't rebuild the input bar.
                renderPanel();
              }
            }
          }

          if (hasNewMessages) {
            isTyping = false;
            refreshChatMessages();
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
            + '&select=id,speaker,text,buttons,timestamp,metadata,attachments';

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
                    attachments: Array.isArray(t.attachments) ? t.attachments : null,
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
    preHandoverWatching = false;
    isInHandover = false;
    isTyping = false;
    renderPanel();
  }
  
  // Append ?download=<filename> so Supabase serves the file with
  // Content-Disposition: attachment instead of inline. The HTML download
  // attribute is ignored cross-origin, so we need server cooperation —
  // otherwise CSV / text files render inline and Chrome shows
  // "missing plugin".
  function withDownloadParam(rawUrl, fileName) {
    try {
      const u = new URL(rawUrl);
      u.searchParams.set('download', fileName || 'file');
      return u.toString();
    } catch (e) {
      return rawUrl;
    }
  }

  // Build the HTML for a single attachment object: { url, fileName, mimeType, size, kind }
  function attachmentHtml(att) {
    if (!att || !att.url) return '';
    const url = escapeHtml(att.url);
    const name = escapeHtml(att.fileName || 'Attachment');
    const kind = att.kind || classifyKind(att.mimeType || '');
    if (kind === 'image') {
      return '<a href="' + url + '" target="_blank" rel="noopener" class="vf-msg-attach"><img src="' + url + '" alt="' + name + '" class="vf-msg-attach-image" /></a>';
    }
    if (kind === 'video') {
      return '<video src="' + url + '" controls preload="metadata" class="vf-msg-attach vf-msg-attach-video"></video>';
    }
    if (kind === 'audio') {
      return '<audio src="' + url + '" controls preload="metadata" class="vf-msg-attach vf-msg-attach-audio"></audio>';
    }
    const fileUrl = escapeHtml(withDownloadParam(att.url, att.fileName || 'file'));
    return '<a href="' + fileUrl + '" target="_blank" rel="noopener" class="vf-msg-attach vf-msg-attach-file">'
      +   '<span class="vf-msg-attach-file-icon">'
      +     '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
      +   '</span>'
      +   '<span class="vf-msg-attach-file-meta">'
      +     '<span class="vf-msg-attach-file-name">' + name + '</span>'
      +   '</span>'
      +   '<span class="vf-msg-attach-file-dl">'
      +     '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
      +   '</span>'
      + '</a>';
  }

  // Build the inner HTML for a single message based on its data + click state.
  // Pulled out so the incremental renderer can use it for both initial inserts
  // and live updates (e.g. button click state).
  function buildMessageMarkup(msg) {
    const isUser = msg.speaker === 'user';
    const isSystem = msg.speaker === 'system';
    const isAgent = msg.speaker === 'client_user';

    // Prefer the structured attachments column (new path). Fall back to the
    // legacy "[Image|File: name]\\nurl" inline string for older messages still
    // in the wild.
    let messageContent = msg.text || '';
    let attachmentsHtml = '';
    const hasStructuredAttachments = Array.isArray(msg.attachments) && msg.attachments.length > 0;
    if (hasStructuredAttachments) {
      attachmentsHtml = msg.attachments.map(attachmentHtml).join('');
    } else {
      const fileMatch = messageContent.match(/\\[(Image|File): ([^\\]]+)\\]\\n(https?:\\/\\/[^\\s]+)/);
      if (fileMatch) {
        const rawFileName = fileMatch[2];
        const rawFileUrl = fileMatch[3];
        const fileName = escapeHtml(rawFileName);
        const fileUrl = escapeHtml(rawFileUrl);
        const isImage = fileMatch[1] === 'Image' || /\\.(jpg|jpeg|png|gif|webp)$/i.test(rawFileUrl);
        // For non-images, route through withDownloadParam so Supabase serves
        // with Content-Disposition: attachment (otherwise CSV/text inline -> "missing plugin").
        const fileLinkUrl = isImage ? fileUrl : escapeHtml(withDownloadParam(rawFileUrl, rawFileName));
        attachmentsHtml = isImage
          ? '<a href="' + fileUrl + '" target="_blank" rel="noopener" class="vf-msg-attach"><img src="' + fileUrl + '" alt="' + fileName + '" class="vf-msg-attach-image" /></a>'
          : '<a href="' + fileLinkUrl + '" target="_blank" rel="noopener" class="vf-msg-attach vf-msg-attach-file">'
            +   '<span class="vf-msg-attach-file-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>'
            +   '<span class="vf-msg-attach-file-meta"><span class="vf-msg-attach-file-name">' + fileName + '</span></span>'
            + '</a>';
        messageContent = messageContent.replace(/\\[(Image|File): [^\\]]+\\]\\n[^\\s]+/, '').trim();
      }
    }

    if (isSystem) {
      return { className: 'vf-msg-system', cssText: '', html: escapeHtml(messageContent), useTextContent: true, text: messageContent };
    }

    if (isUser) {
      const textOnly = messageContent && messageContent.trim();
      let bodyInner;
      if (textOnly && attachmentsHtml) {
        bodyInner = '<div class="vf-msg-user">' + escapeHtml(messageContent) + '</div>' + attachmentsHtml;
      } else if (attachmentsHtml) {
        bodyInner = attachmentsHtml;
      } else {
        bodyInner = '<div class="vf-msg-user">' + escapeHtml(messageContent) + '</div>';
      }
      const html =
        '<div class="vf-msg-body">' + bodyInner +
        '<div class="vf-msg-time">' + formatTime(msg.timestamp) + '</div>' +
        '</div>';
      return { className: 'vf-msg-user-wrap', cssText: '', html, useTextContent: false };
    }

    // Bot / client_user message
    const isClicked = clickedButtonIds.has(msg.id);
    const hasBotBody = (messageContent && messageContent.trim()) || attachmentsHtml;
    const bodyContent = isAgent
      ? \`\${messageContent && messageContent.trim() ? \`<div class="vf-msg-agent">\${escapeHtml(messageContent)}</div>\` : ''}\${attachmentsHtml || ''}\`
      : (hasBotBody
          ? \`\${messageContent && messageContent.trim() ? \`<p class="vf-msg-bot">\${messageContent}</p>\` : ''}\${attachmentsHtml || ''}\`
          : '');
    const html = \`
      \${bodyContent ? \`<div class="vf-msg-body">\${bodyContent}<div class="vf-msg-time">\${formatTime(msg.timestamp)}</div></div>\` : ''}
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
    \`;
    return {
      className: 'vf-msg-bot-wrap',
      cssText: '',
      html,
      useTextContent: false,
    };
  }

  // Incremental message renderer.
  // Previously this nuked the entire #vf-messages list on every call, causing a
  // visible flash on every send/receive/button click — the "glitchy refresh"
  // Silv flagged. Now we:
  //   1. Reuse #vf-messages if it already exists.
  //   2. For each message in state, find its DOM node by data-msg-id. If it
  //      exists AND is unchanged, leave it alone. If it's a bot message with
  //      buttons whose click state changed, only re-render that single node's
  //      inner HTML (buttons are the only mutable part — text/attachments are
  //      immutable once the message arrives).
  //   3. Append new messages.
  //   4. Drop stale typing indicator; add a fresh one when isTyping.
  function renderMessages(container) {
    let messagesEl = document.getElementById('vf-messages');
    if (!messagesEl) {
      container.innerHTML = '<div class="vf-messages-wrap" id="vf-messages"></div>';
      messagesEl = document.getElementById('vf-messages');
    }

    // Pull the typing indicator out (we'll re-append at the end if still typing).
    const oldTyping = messagesEl.querySelector('.vf-typing');
    if (oldTyping) oldTyping.remove();

    // Index existing nodes by msg id. Anything left over after the loop is stale.
    const existing = new Map();
    messagesEl.querySelectorAll('[data-msg-id]').forEach((node) => {
      existing.set(node.getAttribute('data-msg-id'), node);
    });

    let lastNode = null;

    messages.forEach((msg) => {
      const markup = buildMessageMarkup(msg);
      const prior = existing.get(msg.id);

      if (prior) {
        // Update mutable parts only when the rendered HTML signature changes.
        // We stamp data-render-key so we can cheaply detect "did the visible
        // state of this message change since we last rendered it?".
        const newKey = msg.id + '|' + (clickedButtonIds.has(msg.id) ? '1' : '0') + '|' +
          (clickedButtonSelections[msg.id] != null ? clickedButtonSelections[msg.id] : '-');
        const oldKey = prior.getAttribute('data-render-key');
        if (oldKey !== newKey) {
          if (markup.useTextContent) {
            prior.textContent = markup.text;
          } else {
            prior.innerHTML = markup.html;
          }
          prior.setAttribute('data-render-key', newKey);
        }
        existing.delete(msg.id);
        lastNode = prior;
        return;
      }

      // New message — create + append.
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-msg-id', msg.id);
      wrapper.setAttribute(
        'data-render-key',
        msg.id + '|' + (clickedButtonIds.has(msg.id) ? '1' : '0') + '|' +
          (clickedButtonSelections[msg.id] != null ? clickedButtonSelections[msg.id] : '-')
      );
      if (markup.className) wrapper.className = markup.className;
      if (markup.cssText) wrapper.style.cssText = markup.cssText;
      if (markup.useTextContent) {
        wrapper.textContent = markup.text;
      } else {
        wrapper.innerHTML = markup.html;
      }
      messagesEl.appendChild(wrapper);
      lastNode = wrapper;
    });

    // Remove any DOM nodes whose msg id is no longer in state (rare — usually
    // only happens when starting a new chat resets the array).
    existing.forEach((node) => node.remove());

    // Re-attach typing indicator after the latest message if still typing.
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
  
  // === Phase 2: Attachment composer (paperclip + drag-drop, two-phase, handover-gated) ===
  //
  // Flow:
  //   1. User picks/drops files → each valid file is added to uploadQueue
  //      ('queued') and its STAGE upload fires immediately (serially) to
  //      widget-stage-upload. Tile shows progress.
  //   2. On stage success: entry.status = 'ready', entry.staged = {url,...}.
  //      Tile shows the thumbnail (no progress bar). Tile stays visible.
  //   3. User presses Send. If caption is non-empty AND there are no ready
  //      attachments, behave as before (text-only message). If there ARE ready
  //      entries, COMMIT each via widget-file-upload with stagedAttachment.
  //      Caption (if any) attaches to the FIRST committed file's transcript
  //      row. Local user bubbles render from the server response.
  //   4. Tile shows × to remove a queued/uploading/ready/errored entry. If
  //      removed during stage upload, the in-flight XHR is aborted.

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function isAllowedMime(type) {
    return ALLOWED_MIME_TYPES.has(type);
  }

  function classifyKind(mimeType) {
    if (!mimeType) return 'file';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'file';
  }

  function disposeUploadEntry(entry) {
    if (entry && entry.previewUrl) {
      try { URL.revokeObjectURL(entry.previewUrl); } catch (_) {}
      entry.previewUrl = null;
    }
  }

  function handlePickedFiles(fileList) {
    if (!isInHandover) return;
    if (!fileList || fileList.length === 0) return;

    const incoming = Array.from(fileList);
    const remainingSlots = MAX_BATCH_FILES - uploadQueue.length;
    if (remainingSlots <= 0) {
      alert('You can attach up to ' + MAX_BATCH_FILES + ' files at a time.');
      return;
    }
    if (incoming.length > remainingSlots) {
      alert('You can attach up to ' + MAX_BATCH_FILES + ' files at a time. The first ' + remainingSlots + ' will be added.');
    }
    const batch = incoming.slice(0, remainingSlots);

    for (const f of batch) {
      if (f.size > MAX_FILE_BYTES) {
        alert('"' + f.name + '" is too large. Files must be under 10MB.');
        return;
      }
      if (!isAllowedMime(f.type)) {
        alert('"' + f.name + '" is not a supported file type.');
        return;
      }
    }

    for (const f of batch) {
      const kind = classifyKind(f.type);
      const entry = {
        id: 'up_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        file: f,
        kind,
        previewUrl: kind === 'image' ? URL.createObjectURL(f) : null,
        status: 'queued',  // 'queued' | 'uploading' | 'ready' | 'error'
        progress: 0,
        error: null,
        staged: null,      // { url, fileName, mimeType, size, kind, storagePath }
      };
      uploadQueue.push(entry);
    }
    renderAttachPreview();
    processNextUpload();
  }

  function processNextUpload() {
    if (activeUploadXhr) return;
    const next = uploadQueue.find((u) => u.status === 'queued');
    if (!next) return;
    startUpload(next);
  }

  function startUpload(entry) {
    entry.status = 'uploading';
    entry.progress = 0;
    entry.error = null;
    renderAttachPreview();

    const xhr = new XMLHttpRequest();
    activeUploadXhr = xhr;
    // STAGE upload: storage only, no transcript write.
    xhr.open('POST', SUPABASE_URL + '/functions/v1/widget-stage-upload', true);

    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      entry.progress = Math.min(99, Math.round((ev.loaded / ev.total) * 100));
      const bar = document.querySelector('[data-upload-id="' + entry.id + '"] .vf-attach-tile-progress-bar');
      if (bar) bar.style.width = entry.progress + '%';
    };

    xhr.onload = () => {
      activeUploadXhr = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        let body = {};
        try { body = JSON.parse(xhr.responseText || '{}'); } catch (_) {}
        const att = body.attachment || null;
        if (!att || !att.url) {
          entry.status = 'error';
          entry.error = 'Upload returned no URL';
          renderAttachPreview();
          processNextUpload();
          return;
        }
        // Stage complete — the file is in storage. Wait for Send to commit.
        entry.status = 'ready';
        entry.staged = att;
        entry.progress = 100;
        renderAttachPreview();
        processNextUpload();
        return;
      }

      let msg = 'Upload failed';
      try {
        const j = JSON.parse(xhr.responseText || '{}');
        msg = j.message || j.error || msg;
      } catch (_) {}
      entry.status = 'error';
      entry.error = msg;
      renderAttachPreview();
      processNextUpload();
    };

    xhr.onerror = () => {
      activeUploadXhr = null;
      entry.status = 'error';
      entry.error = 'Network error';
      renderAttachPreview();
      processNextUpload();
    };

    xhr.onabort = () => {
      activeUploadXhr = null;
      // Per-tile remove already handled state; just kick the queue.
      processNextUpload();
    };

    const form = new FormData();
    form.append('file', entry.file);
    form.append('agentId', CONFIG.agentId);
    if (conversationId) form.append('conversationId', conversationId);
    xhr.send(form);
  }

  // Commit one staged entry: tells widget-file-upload to write the transcript
  // (and forward to voiceflow-interact) using the already-uploaded URL. Returns
  // the parsed JSON body on success, throws on failure.
  function commitStagedEntry(entry, captionText) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', SUPABASE_URL + '/functions/v1/widget-file-upload', true);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          let body = {};
          try { body = JSON.parse(xhr.responseText || '{}'); } catch (_) {}
          resolve(body);
          return;
        }
        let msg = 'Send failed';
        try {
          const j = JSON.parse(xhr.responseText || '{}');
          msg = j.message || j.error || msg;
        } catch (_) {}
        reject(new Error(msg));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.onabort = () => reject(new Error('Aborted'));

      const form = new FormData();
      form.append('stagedAttachment', JSON.stringify(entry.staged));
      form.append('agentId', CONFIG.agentId);
      form.append('userId', getVoiceflowUserId());
      if (conversationId) form.append('conversationId', conversationId);
      if (currentVoiceflowSessionId) form.append('voiceflowSessionId', currentVoiceflowSessionId);
      form.append('isTestMode', CONFIG.isTestMode ? 'true' : 'false');
      form.append('text', captionText || '');
      xhr.send(form);
    });
  }

  window.vfAttachFile = function() {
    if (!isInHandover) return;
    if (uploadQueue.length >= MAX_BATCH_FILES) {
      alert('You can attach up to ' + MAX_BATCH_FILES + ' files at a time.');
      return;
    }
    const fileInput = document.getElementById('vf-file-input');
    if (fileInput) fileInput.click();
  };

  // Per-tile remove. If the entry is uploading, abort its XHR. Otherwise drop
  // it from the queue. No batch cancel — each tile owns its own ×.
  // NOTE: removing a 'ready' entry leaves the staged file orphaned in storage.
  // Acceptable for now — a future janitor can sweep widget-attachments objects
  // older than N hours that have no matching transcript row.
  window.vfRemovePendingAttachment = function(id) {
    if (isCommittingSend) return;
    const entry = uploadQueue.find((u) => u.id === id);
    if (!entry) return;

    if (entry.status === 'uploading' && activeUploadXhr) {
      try { activeUploadXhr.abort(); } catch (_) {}
      // onabort handler clears activeUploadXhr.
    }
    disposeUploadEntry(entry);
    uploadQueue = uploadQueue.filter((u) => u !== entry);
    renderAttachPreview();
    processNextUpload();
  };

  // Retry an errored entry. Re-queues it and kicks the worker.
  window.vfRetryUpload = function(id) {
    const entry = uploadQueue.find((u) => u.id === id);
    if (!entry || entry.status !== 'error') return;
    entry.status = 'queued';
    entry.error = null;
    entry.progress = 0;
    renderAttachPreview();
    processNextUpload();
  };

  function renderAttachPreview() {
    const host = document.getElementById('vf-attach-preview-host');
    if (!host) return;

    // Handover ended — drop pending work and hide the row. In-flight uploads
    // continue (the server commits and the user just won't see the tile).
    if (!isInHandover) {
      for (const e of uploadQueue) disposeUploadEntry(e);
      uploadQueue = [];
      host.innerHTML = '';
      return;
    }

    if (uploadQueue.length === 0) {
      host.innerHTML = '';
      return;
    }

    const tilesHtml = uploadQueue.map((entry) => {
      const inner = entry.kind === 'image' && entry.previewUrl
        ? '<img src="' + escapeHtml(entry.previewUrl) + '" alt="" />'
        : (entry.kind === 'video'
          ? '<svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>'
          : (entry.kind === 'audio'
            ? '<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
            : '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'));

      const overlayHtml = entry.status === 'uploading'
        ? '<div class="vf-attach-tile-progress"><div class="vf-attach-tile-progress-bar" style="width:' + entry.progress + '%"></div></div>'
        : (entry.status === 'error'
          ? '<button class="vf-attach-tile-error" onclick="window.vfRetryUpload(\\'' + entry.id + '\\')" title="' + escapeHtml(entry.error || 'Upload failed') + ' — click to retry">'
              + '<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>'
            + '</button>'
          : '');

      const closeBtn = isCommittingSend
        ? ''
        : '<button class="vf-attach-tile-close" onclick="window.vfRemovePendingAttachment(\\'' + entry.id + '\\')" aria-label="Remove">'
            + '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
          + '</button>';

      return '<div class="vf-attach-tile" data-upload-id="' + entry.id + '">'
        + '<div class="vf-attach-tile-thumb">' + inner + '</div>'
        + overlayHtml
        + closeBtn
        + '</div>';
    }).join('');

    host.innerHTML = '<div class="vf-attach-preview-row">' + tilesHtml + '</div>';
  }

  function attachDragDropHandlers(panel) {
    const overlay = panel.querySelector('#vf-dropzone');
    const setOverlay = () => {
      if (!overlay) return;
      overlay.classList.toggle('active', isDragging);
      overlay.classList.toggle('invalid', isDragging && dragInvalid);
      const label = overlay.querySelector('#vf-dropzone-label');
      if (label) {
        label.textContent = dragInvalid ? 'Unsupported file' : 'Drop to attach';
      }
    };

    // Only treat a drag as "interesting" if it carries files. A drag over
    // selected page text or a link from elsewhere on the host page should
    // NOT flash the overlay.
    const dragIsFiles = (e) => {
      const types = e.dataTransfer ? e.dataTransfer.types : null;
      if (!types) return false;
      for (let i = 0; i < types.length; i += 1) {
        if (types[i] === 'Files') return true;
      }
      return false;
    };

    const resetDrag = () => {
      if (!isDragging && !dragInvalid) return;
      isDragging = false;
      dragInvalid = false;
      setOverlay();
    };

    panel.addEventListener('dragenter', (e) => {
      if (!isInHandover) return;
      if (!dragIsFiles(e)) return;
      e.preventDefault();
      // relatedTarget is null when entering from outside the browser, or
      // the element we left when moving between children inside the panel.
      // If it's a child of the panel, we're already mid-drag — no state
      // change needed.
      const related = e.relatedTarget;
      if (related && panel.contains(related)) return;
      isDragging = true;
      // Best-effort MIME check on enter. Some browsers (Safari) hide types
      // until drop, so this is just to flash the red invalid state when we
      // can; the actual validation in handlePickedFiles() is authoritative.
      let invalid = false;
      const items = e.dataTransfer ? e.dataTransfer.items : null;
      if (items && items.length) {
        for (let i = 0; i < items.length; i += 1) {
          const it = items[i];
          if (it.kind !== 'file') continue;
          if (it.type && !isAllowedMime(it.type)) { invalid = true; break; }
        }
      }
      dragInvalid = invalid;
      setOverlay();
    });

    panel.addEventListener('dragover', (e) => {
      if (!isInHandover) return;
      if (!dragIsFiles(e)) return;
      // preventDefault on dragover is REQUIRED for drop to fire. Without
      // it, the OS treats the drop as a file-open navigation.
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = dragInvalid ? 'none' : 'copy';
      }
    });

    panel.addEventListener('dragleave', (e) => {
      if (!isDragging) return;
      const related = e.relatedTarget;
      // Moving between panel children — still inside, no change.
      if (related && panel.contains(related)) return;
      resetDrag();
    });

    panel.addEventListener('drop', (e) => {
      if (!isInHandover) {
        e.preventDefault();
        resetDrag();
        return;
      }
      e.preventDefault();
      const wasInvalid = dragInvalid;
      resetDrag();
      if (wasInvalid) return;
      const files = e.dataTransfer ? e.dataTransfer.files : null;
      if (files && files.length) {
        handlePickedFiles(files);
      }
    });

    // Window-level reset failsafe. If the user drags out of the browser,
    // hits ESC, or drops outside the panel, dragleave on the panel may
    // never fire — leaving the overlay stuck on. dragend / window drop
    // always fire, so we hook those as a belt-and-braces backstop.
    window.addEventListener('dragend', resetDrag);
    window.addEventListener('drop', (e) => {
      // If the drop happened outside the panel, dragend may not fire —
      // but a global drop will. Reset to be safe.
      if (!panel.contains(e.target)) {
        resetDrag();
      }
    });
  }
  
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
    refreshChatMessages();
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

      // Now that we have a conversationId, start the pre-handover transcript
      // watch so an early agent takeover during the AI portion is detected.
      ensurePreHandoverWatch();

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
        // Flip isInHandover BEFORE renderPanel so the input bar is rebuilt with
        // the paperclip visible immediately. Was previously after, which left
        // the paperclip hidden until the user sent another message.
        if (!isInHandover) {
          isInHandover = true;
          preHandoverWatching = false;
          startHandoverRealtime();
        }
        renderPanel();
        scrollToLatestMessage();
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
          refreshChatMessages();
          scrollToLatestMessage();
        }
      } else {
        isTyping = false;
        refreshChatMessages();
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
      refreshChatMessages();
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
        // Start pre-handover transcript watch so an early agent takeover is
        // detected even before the user sends their first message.
        ensurePreHandoverWatch();
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
          refreshChatMessages();
        }
      } else {
        isTyping = false;
        refreshChatMessages();
      }

      // Save conversation immediately after bot responses (launch only, no user interaction yet)
      if (conversationId && messages.length > 0) {
        SessionManager.saveConversation(conversationId, messages, currentVoiceflowSessionId, false);
      }
    } catch (error) {
      console.error('Start chat error:', error);
      isTyping = false;
      refreshChatMessages();
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
    refreshChatMessages();

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

      // Now that we have a conversationId, start the pre-handover transcript
      // watch so an early agent takeover during the AI portion is detected.
      ensurePreHandoverWatch();

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
        // Flip isInHandover BEFORE renderPanel so the input bar is rebuilt with
        // the paperclip visible immediately on handover start.
        if (!isInHandover) {
          isInHandover = true;
          preHandoverWatching = false;
          startHandoverRealtime();
        }
        renderPanel();
        scrollToLatestMessage();
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
          refreshChatMessages();
        }
      } else {
        isTyping = false;
        refreshChatMessages();
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
      refreshChatMessages();
    }
  }
  
  // Global functions
  window.vfCloseWidget = function() {
    isOpen = false;
    chatPanel.classList.add('hidden');
    updateFabIcon();
  };
  
  window.vfSendMessage = async function() {
    if (isCommittingSend) return;
    const input = document.getElementById('vf-input');
    const captionText = input ? (input.value || '') : '';

    // If there are staged attachments waiting to commit, commit them first.
    // The caption (if any) attaches to the FIRST committed file's transcript
    // bubble; subsequent files commit with empty text. Only one widget-file-
    // upload call per file — but they go in pick-order so the dashboard sees
    // them in the right order.
    const ready = uploadQueue.filter((u) => u.status === 'ready');
    const stillUploading = uploadQueue.some((u) => u.status === 'uploading' || u.status === 'queued');

    if (ready.length === 0 && stillUploading) {
      // User pressed Send while a file is still uploading. Don't fire — wait
      // for it to finish. Cheaper UX than a toast: just leave the input alone.
      return;
    }

    if (ready.length === 0) {
      // No attachments → caption-only send (existing path).
      if (input) sendMessage(input.value);
      return;
    }

    // We have files to commit.
    isCommittingSend = true;
    if (input) {
      input.value = '';
      input.disabled = true;
    }
    renderAttachPreview();

    let committedAny = false;
    let firstError = null;
    for (let i = 0; i < ready.length; i++) {
      const entry = ready[i];
      const captionForThis = i === 0 ? captionText : '';
      try {
        const body = await commitStagedEntry(entry, captionForThis);
        if (body && body.conversationId && body.conversationId !== conversationId) {
          conversationId = body.conversationId;
        }
        const att = body && body.attachment ? body.attachment : entry.staged;
        // Push a local user bubble carrying the attachment + caption (only on
        // the first file). Poller skips user-speaker rows, so we won't dup.
        messages.push({
          id: 'msg_attach_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          speaker: 'user',
          text: captionForThis || '',
          attachments: [att],
          timestamp: new Date().toISOString(),
        });
        disposeUploadEntry(entry);
        uploadQueue = uploadQueue.filter((u) => u !== entry);
        committedAny = true;
        renderPanel();
        scrollToLatestMessage();
      } catch (err) {
        firstError = err;
        entry.status = 'error';
        entry.error = (err && err.message) || 'Send failed';
        renderAttachPreview();
        break;
      }
    }

    if (committedAny && conversationId) {
      SessionManager.saveConversation(conversationId, messages, currentVoiceflowSessionId, true);
    }

    isCommittingSend = false;
    if (input) {
      input.disabled = false;
      input.focus();
    }
    renderAttachPreview();

    if (firstError) {
      // Surface failure inline in the tile (already set above). Caption stays
      // on the failed entry's row in the user's mind — they can retry.
      console.warn('[widget] commit failed:', firstError);
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
      ensurePreHandoverWatch();
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
