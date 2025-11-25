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
    const config = {
      agentId: agent.id,
      agentName: agent.name,
      title: widgetSettings.title || 'Chat with us',
      description: widgetSettings.description || "We're here to help",
      brandingUrl: widgetSettings.branding_url || '',
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
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
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
  const interactUrl = `${supabaseUrl}/functions/v1/voiceflow-interact`;

  return `
(function() {
  'use strict';
  
  // Configuration
  const CONFIG = ${JSON.stringify(config, null, 2)};
  const INTERACT_URL = '${interactUrl}';
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
    
    saveConversation(conversationId, messages) {
      const session = this.getSession();
      if (!session) return;
      
      const existingIndex = session.conversations.findIndex(c => c.id === conversationId);
      const conversation = {
        id: conversationId,
        messages,
        timestamp: new Date().toISOString(),
        preview: messages[0]?.text || 'New conversation',
        messageCount: messages.length
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
      return session?.conversations || [];
    }
  };
  
  // Inject CSS
  const style = document.createElement('style');
  style.textContent = \`
    @import url('https://fonts.googleapis.com/css2?family=\${CONFIG.appearance.fontFamily.replace(' ', '+')}:wght@400;500;600;700&display=swap');
    
    .vf-widget-container * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    .vf-widget-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: \${CONFIG.appearance.primaryColor};
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999998;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .vf-widget-button:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }
    
    .vf-widget-button img {
      width: 32px;
      height: 32px;
      object-fit: contain;
    }
    
    .vf-widget-button svg {
      width: 32px;
      height: 32px;
      fill: white;
    }
    
    .vf-widget-panel {
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 380px;
      max-width: calc(100vw - 40px);
      height: 600px;
      max-height: calc(100vh - 120px);
      background: \${CONFIG.appearance.secondaryColor};
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      font-family: \${CONFIG.appearance.fontFamily}, sans-serif;
      font-size: \${CONFIG.appearance.fontSize}px;
      color: \${CONFIG.appearance.textColor};
      overflow: hidden;
      transition: opacity 0.2s, transform 0.2s;
    }
    
    .vf-widget-panel.hidden {
      opacity: 0;
      transform: scale(0.95);
      pointer-events: none;
    }
    
    .vf-widget-header {
      background: \${CONFIG.appearance.primaryColor};
      color: white;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    
    .vf-widget-header img {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      background: white;
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
      color: white;
      cursor: pointer;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.2s;
    }
    
    .vf-widget-close:hover {
      background: rgba(255,255,255,0.2);
    }
    
    .vf-widget-tabs {
      display: flex;
      border-bottom: 1px solid rgba(0,0,0,0.1);
      flex-shrink: 0;
    }
    
    .vf-widget-tab {
      flex: 1;
      padding: 12px;
      text-align: center;
      cursor: pointer;
      border: none;
      background: transparent;
      color: \${CONFIG.appearance.textColor};
      font-family: inherit;
      font-size: inherit;
      transition: background 0.2s;
    }
    
    .vf-widget-tab:hover {
      background: rgba(0,0,0,0.05);
    }
    
    .vf-widget-tab.active {
      border-bottom: 2px solid \${CONFIG.appearance.primaryColor};
      color: \${CONFIG.appearance.primaryColor};
      font-weight: 600;
    }
    
    .vf-widget-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
    }
    
    .vf-widget-home {
      text-align: center;
    }
    
    .vf-widget-home-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .vf-widget-home-subtitle {
      color: rgba(0,0,0,0.6);
      margin-bottom: 24px;
    }
    
    .vf-widget-home-buttons {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .vf-widget-home-button {
      padding: 14px 20px;
      border: none;
      border-radius: 12px;
      background: \${CONFIG.appearance.primaryColor};
      color: white;
      font-family: inherit;
      font-size: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .vf-widget-home-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    .vf-widget-messages {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
    }
    
    .vf-widget-message {
      display: flex;
      gap: 8px;
      animation: fadeIn 0.3s;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .vf-widget-message.user {
      flex-direction: row-reverse;
    }
    
    .vf-widget-message-bubble {
      padding: 12px 16px;
      max-width: 75%;
      word-wrap: break-word;
      border-radius: \${CONFIG.appearance.messageBubbleStyle === 'rounded' ? '12px' : CONFIG.appearance.messageBubbleStyle === 'pill' ? '20px' : '4px'};
    }
    
    .vf-widget-message.assistant .vf-widget-message-bubble {
      background: \${CONFIG.functions.messageBgColor};
      color: \${CONFIG.functions.messageTextColor};
    }
    
    .vf-widget-message.user .vf-widget-message-bubble {
      background: \${CONFIG.appearance.primaryColor};
      color: white;
    }
    
    .vf-widget-message-buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 8px;
    }
    
    .vf-widget-message-button {
      padding: 10px 16px;
      border: 1px solid \${CONFIG.appearance.primaryColor};
      background: white;
      color: \${CONFIG.appearance.primaryColor};
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
      font-size: inherit;
      transition: all 0.2s;
    }
    
    .vf-widget-message-button:hover:not(:disabled) {
      background: \${CONFIG.appearance.primaryColor};
      color: white;
    }
    
    .vf-widget-message-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .vf-widget-typing {
      display: flex;
      gap: 4px;
      padding: 12px 16px;
      background: \${CONFIG.functions.messageBgColor};
      border-radius: 12px;
      width: fit-content;
    }
    
    .vf-widget-typing-dot {
      width: 8px;
      height: 8px;
      background: rgba(0,0,0,0.4);
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out both;
    }
    
    .vf-widget-typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .vf-widget-typing-dot:nth-child(2) { animation-delay: -0.16s; }
    
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
    
    .vf-widget-input-area {
      padding: 12px 16px;
      border-top: 1px solid rgba(0,0,0,0.1);
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    
    .vf-widget-input {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid rgba(0,0,0,0.2);
      border-radius: 8px;
      font-family: inherit;
      font-size: inherit;
      outline: none;
      transition: border-color 0.2s;
    }
    
    .vf-widget-input:focus {
      border-color: \${CONFIG.appearance.primaryColor};
    }
    
    .vf-widget-send {
      padding: 10px 16px;
      background: \${CONFIG.appearance.primaryColor};
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 0.2s;
    }
    
    .vf-widget-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .vf-widget-conversation-card {
      padding: 12px;
      border-radius: 12px;
      background: rgba(0,0,0,0.03);
      cursor: pointer;
      transition: background 0.2s;
      margin-bottom: 8px;
    }
    
    .vf-widget-conversation-card:hover {
      background: rgba(0,0,0,0.06);
    }
    
    .vf-widget-conversation-preview {
      font-weight: 500;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .vf-widget-conversation-meta {
      font-size: 12px;
      color: rgba(0,0,0,0.5);
    }
  \`;
  document.head.appendChild(style);
  
  // Widget State
  let isOpen = false;
  let messages = [];
  let conversationId = null;
  let userId = '';
  let isTyping = false;
  let currentTab = 'Home';
  let isInActiveChat = false;
  let clickedButtonIds = new Set();
  
  // Create Widget Container
  const container = document.createElement('div');
  container.className = 'vf-widget-container';
  container.innerHTML = \`
    <button class="vf-widget-button" id="vf-chat-button">
      \${CONFIG.appearance.chatIconUrl 
        ? \`<img src="\${CONFIG.appearance.chatIconUrl}" alt="Chat" />\`
        : \`<svg viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>\`
      }
    </button>
    <div class="vf-widget-panel hidden" id="vf-chat-panel">
      <div class="vf-widget-header">
        \${CONFIG.appearance.logoUrl ? \`<img src="\${CONFIG.appearance.logoUrl}" alt="Logo" />\` : ''}
        <div class="vf-widget-header-text">
          <div class="vf-widget-header-title">\${CONFIG.title}</div>
          <div class="vf-widget-header-desc">\${CONFIG.description}</div>
        </div>
        <button class="vf-widget-close" id="vf-chat-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="vf-widget-tabs" id="vf-tabs"></div>
      <div class="vf-widget-content" id="vf-content"></div>
      <div class="vf-widget-input-area hidden" id="vf-input-area">
        <input type="text" class="vf-widget-input" id="vf-input" placeholder="Type a message..." />
        <button class="vf-widget-send" id="vf-send">Send</button>
      </div>
    </div>
  \`;
  document.body.appendChild(container);
  
  // Elements
  const chatButton = document.getElementById('vf-chat-button');
  const chatPanel = document.getElementById('vf-chat-panel');
  const closeButton = document.getElementById('vf-chat-close');
  const tabsContainer = document.getElementById('vf-tabs');
  const contentContainer = document.getElementById('vf-content');
  const inputArea = document.getElementById('vf-input-area');
  const input = document.getElementById('vf-input');
  const sendButton = document.getElementById('vf-send');
  
  // Initialize
  const session = SessionManager.initSession();
  userId = session.userId;
  
  if (session.currentConversationId) {
    const conv = SessionManager.loadConversation(session.currentConversationId);
    if (conv) {
      messages = conv.messages;
      conversationId = conv.id;
      isInActiveChat = true;
    }
  }
  
  // Render tabs
  function renderTabs() {
    const tabs = [];
    if (CONFIG.tabs.home.enabled) tabs.push('Home');
    if (CONFIG.tabs.chats.enabled) tabs.push('Chats');
    if (CONFIG.tabs.faq.enabled) tabs.push('FAQ');
    
    tabsContainer.innerHTML = tabs.map(tab => 
      \`<button class="vf-widget-tab \${tab === currentTab ? 'active' : ''}" data-tab="\${tab}">\${tab}</button>\`
    ).join('');
    
    tabsContainer.querySelectorAll('.vf-widget-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        currentTab = tab.dataset.tab;
        renderContent();
      });
    });
  }
  
  // Render content
  function renderContent() {
    renderTabs();
    
    if (currentTab === 'Home' && !isInActiveChat) {
      renderHome();
    } else if (currentTab === 'Chats') {
      if (isInActiveChat) {
        renderChat();
      } else {
        renderChatHistory();
      }
    } else if (currentTab === 'FAQ') {
      renderFAQ();
    } else {
      renderChat();
    }
  }
  
  function renderHome() {
    inputArea.classList.add('hidden');
    contentContainer.innerHTML = \`
      <div class="vf-widget-home">
        <div class="vf-widget-home-title">\${CONFIG.tabs.home.title}</div>
        <div class="vf-widget-home-subtitle">\${CONFIG.tabs.home.subtitle}</div>
        <div class="vf-widget-home-buttons" id="vf-home-buttons"></div>
      </div>
    \`;
    
    const buttonsContainer = document.getElementById('vf-home-buttons');
    CONFIG.tabs.home.buttons.filter(btn => btn.enabled).forEach(btn => {
      const button = document.createElement('button');
      button.className = 'vf-widget-home-button';
      button.textContent = btn.text;
      button.onclick = () => handleHomeButtonAction(btn.action, btn.phone_number);
      buttonsContainer.appendChild(button);
    });
  }
  
  function renderChatHistory() {
    inputArea.classList.add('hidden');
    const history = SessionManager.getConversationHistory();
    
    if (history.length === 0) {
      contentContainer.innerHTML = \`
        <div style="text-align: center; padding: 40px 20px; color: rgba(0,0,0,0.5);">
          <p>No conversations yet</p>
          <button class="vf-widget-home-button" onclick="window.vfStartNewChat()" style="margin-top: 20px;">
            Start a new chat
          </button>
        </div>
      \`;
    } else {
      contentContainer.innerHTML = history.map(conv => \`
        <div class="vf-widget-conversation-card" onclick="window.vfLoadConversation('\${conv.id}')">
          <div class="vf-widget-conversation-preview">\${conv.preview}</div>
          <div class="vf-widget-conversation-meta">
            \${new Date(conv.timestamp).toLocaleDateString()} • \${conv.messageCount} messages
          </div>
        </div>
      \`).join('');
    }
  }
  
  function renderChat() {
    inputArea.classList.remove('hidden');
    contentContainer.innerHTML = '<div class="vf-widget-messages" id="vf-messages"></div>';
    const messagesContainer = document.getElementById('vf-messages');
    
    messages.forEach(msg => {
      const messageEl = document.createElement('div');
      messageEl.className = \`vf-widget-message \${msg.speaker}\`;
      
      const bubble = document.createElement('div');
      bubble.className = 'vf-widget-message-bubble';
      bubble.textContent = msg.text || '';
      messageEl.appendChild(bubble);
      
      if (msg.buttons && !clickedButtonIds.has(msg.id)) {
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'vf-widget-message-buttons';
        msg.buttons.forEach(btn => {
          const button = document.createElement('button');
          button.className = 'vf-widget-message-button';
          button.textContent = btn.text;
          button.onclick = () => handleButtonClick(btn.payload, btn.text, msg.id);
          buttonsContainer.appendChild(button);
        });
        bubble.appendChild(buttonsContainer);
      }
      
      messagesContainer.appendChild(messageEl);
    });
    
    if (isTyping) {
      const typingEl = document.createElement('div');
      typingEl.className = 'vf-widget-typing';
      typingEl.innerHTML = '<div class="vf-widget-typing-dot"></div><div class="vf-widget-typing-dot"></div><div class="vf-widget-typing-dot"></div>';
      messagesContainer.appendChild(typingEl);
    }
    
    contentContainer.scrollTop = contentContainer.scrollHeight;
  }
  
  function renderFAQ() {
    inputArea.classList.add('hidden');
    if (CONFIG.tabs.faq.items.length === 0) {
      contentContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: rgba(0,0,0,0.5);">No FAQs available</div>';
    } else {
      contentContainer.innerHTML = CONFIG.tabs.faq.items.map((item, i) => \`
        <details style="margin-bottom: 12px; padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.03);">
          <summary style="cursor: pointer; font-weight: 500;">\${item.question}</summary>
          <p style="margin-top: 8px; color: rgba(0,0,0,0.7);">\${item.answer}</p>
        </details>
      \`).join('');
    }
  }
  
  async function sendMessage(text) {
    if (!text.trim()) return;
    
    const userMsg = {
      id: 'msg_' + Date.now(),
      speaker: 'user',
      text,
      timestamp: new Date().toISOString()
    };
    
    messages.push(userMsg);
    input.value = '';
    isTyping = true;
    renderChat();
    
    try {
      const response = await fetch(INTERACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: CONFIG.agentId,
          userId,
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
          renderChat();
        }
      } else {
        isTyping = false;
        renderChat();
      }
      
      if (conversationId) {
        SessionManager.saveConversation(conversationId, messages);
      }
    } catch (error) {
      console.error('Send message error:', error);
      isTyping = false;
      renderChat();
    }
  }
  
  async function handleButtonClick(payload, text, messageId) {
    clickedButtonIds.add(messageId);
    
    const userMsg = {
      id: 'msg_' + Date.now(),
      speaker: 'user',
      text,
      timestamp: new Date().toISOString()
    };
    
    messages.push(userMsg);
    isTyping = true;
    renderChat();
    
    try {
      const response = await fetch(INTERACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: CONFIG.agentId,
          userId,
          message: JSON.stringify(payload),
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
          renderChat();
        }
      } else {
        isTyping = false;
        renderChat();
      }
      
      if (conversationId) {
        SessionManager.saveConversation(conversationId, messages);
      }
    } catch (error) {
      console.error('Button click error:', error);
      isTyping = false;
      renderChat();
    }
  }
  
  async function startNewChat() {
    messages = [];
    conversationId = null;
    clickedButtonIds.clear();
    SessionManager.startNewConversation();
    
    isInActiveChat = true;
    currentTab = 'Chats';
    renderContent();
    
    isTyping = true;
    renderChat();
    
    try {
      const response = await fetch(INTERACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: CONFIG.agentId,
          userId,
          action: 'launch',
          conversationId: null,
          isTestMode: false
        })
      });
      
      const data = await response.json();
      
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
          renderChat();
        }
      } else {
        isTyping = false;
        renderChat();
      }
    } catch (error) {
      console.error('Start chat error:', error);
      isTyping = false;
      renderChat();
    }
  }
  
  function handleHomeButtonAction(action, phoneNumber) {
    if (action === 'new_chat') {
      startNewChat();
    } else if (action === 'call' && phoneNumber) {
      window.location.href = 'tel:' + phoneNumber;
    }
  }
  
  window.vfStartNewChat = startNewChat;
  window.vfLoadConversation = function(convId) {
    const conv = SessionManager.loadConversation(convId);
    if (conv) {
      messages = conv.messages;
      conversationId = conv.id;
      isInActiveChat = true;
      renderContent();
    }
  };
  
  // Event listeners
  chatButton.addEventListener('click', () => {
    isOpen = !isOpen;
    chatPanel.classList.toggle('hidden');
    if (isOpen) renderContent();
  });
  
  closeButton.addEventListener('click', () => {
    isOpen = false;
    chatPanel.classList.add('hidden');
  });
  
  sendButton.addEventListener('click', () => sendMessage(input.value));
  
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage(input.value);
  });
  
  renderContent();
})();
`;
}
