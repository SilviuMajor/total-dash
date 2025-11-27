interface Message {
  id: string;
  speaker: 'user' | 'assistant';
  text?: string;
  buttons?: Array<{ text: string; payload: any }>;
  timestamp: string;
}

interface Conversation {
  id: string;
  preview: string;
  timestamp: string;
  messageCount: number;
  messages: Message[];
}

interface WidgetSession {
  userId: string;
  sessionId: string;
  conversationHistory: Conversation[];
  currentConversationId: string | null;
  createdAt: string;
  lastActiveAt: string;
}

export const widgetSessionManager = {
  // Initialize or restore session
  initSession: (agentId: string): WidgetSession => {
    const storageKey = `voiceflow_session_${agentId}`;
    const existing = localStorage.getItem(storageKey);
    
    if (existing) {
      const session = JSON.parse(existing);
      // Update last active timestamp
      session.lastActiveAt = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify(session));
      return session;
    }
    
    // Create new session
    const newSession: WidgetSession = {
      userId: `user-${crypto.randomUUID().substring(0, 12)}`,
      sessionId: crypto.randomUUID(),
      conversationHistory: [],
      currentConversationId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    };
    
    localStorage.setItem(storageKey, JSON.stringify(newSession));
    return newSession;
  },
  
  // Save conversation to history
  saveConversation: (agentId: string, conversation: {
    id: string;
    messages: Message[];
  }) => {
    const storageKey = `voiceflow_session_${agentId}`;
    const session = widgetSessionManager.initSession(agentId);
    
    const existingIndex = session.conversationHistory.findIndex(
      c => c.id === conversation.id
    );
    
    const lastMessage = conversation.messages.length > 0 
      ? conversation.messages[conversation.messages.length - 1] 
      : null;
    const conversationData: Conversation = {
      id: conversation.id,
      preview: lastMessage?.text?.substring(0, 60) || "New conversation",
      timestamp: new Date().toISOString(),
      messageCount: conversation.messages.length,
      messages: conversation.messages
    };
    
    if (existingIndex >= 0) {
      session.conversationHistory[existingIndex] = conversationData;
    } else {
      session.conversationHistory.unshift(conversationData);
    }
    
    session.currentConversationId = conversation.id;
    session.lastActiveAt = new Date().toISOString();
    
    localStorage.setItem(storageKey, JSON.stringify(session));
  },
  
  // Load conversation by ID
  loadConversation: (agentId: string, conversationId: string): Conversation | undefined => {
    const session = widgetSessionManager.initSession(agentId);
    return session.conversationHistory.find(c => c.id === conversationId);
  },
  
  // Get all conversations
  getConversationHistory: (agentId: string): Conversation[] => {
    const session = widgetSessionManager.initSession(agentId);
    return session.conversationHistory;
  },
  
  // Start new conversation
  startNewConversation: (agentId: string) => {
    const storageKey = `voiceflow_session_${agentId}`;
    const session = widgetSessionManager.initSession(agentId);
    session.currentConversationId = null;
    localStorage.setItem(storageKey, JSON.stringify(session));
  },

  // Clear current session completely
  clearCurrentSession: (agentId: string) => {
    const storageKey = `voiceflow_session_${agentId}`;
    const session = widgetSessionManager.initSession(agentId);
    session.currentConversationId = null;
    localStorage.setItem(storageKey, JSON.stringify(session));
  }
};
