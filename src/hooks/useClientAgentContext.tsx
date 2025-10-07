import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useLocation } from 'react-router-dom';

interface Agent {
  id: string;
  name: string;
  provider: string;
  sort_order: number;
}

interface AgentPermissions {
  analytics: boolean;
  conversations: boolean;
  knowledge_base: boolean;
  agent_settings: boolean;
}

interface ClientAgentContextType {
  agents: Agent[];
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string) => void;
  selectedAgentPermissions: AgentPermissions | null;
  loading: boolean;
  clientId: string | null;
}

const ClientAgentContext = createContext<ClientAgentContextType | undefined>(undefined);

export function ClientAgentProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentPermissions, setSelectedAgentPermissions] = useState<AgentPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const { user, profile } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Parse URL for preview mode
    const searchParams = new URLSearchParams(location.search);
    const isPreviewMode = searchParams.get('preview') === 'true';
    const previewClientId = searchParams.get('clientId');

    if (user && profile) {
      if (profile.role === 'admin' && isPreviewMode && previewClientId) {
        // Admin preview mode: use clientId from URL
        loadClientAgentsForPreview(previewClientId);
      } else if (profile.role === 'client') {
        // Normal client mode: load from client_users
        loadClientAgents();
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [user, profile, location.search]);

  const loadClientAgentsForPreview = async (previewClientId: string) => {
    try {
      setClientId(previewClientId);

      // Get agents assigned to this client
      const { data: assignments, error: assignmentsError } = await supabase
        .from('agent_assignments')
        .select(`
          agent_id,
          sort_order,
          agents (
            id,
            name,
            provider
          )
        `)
        .eq('client_id', previewClientId)
        .order('sort_order', { ascending: true });

      if (assignmentsError) throw assignmentsError;

      const agentsList = assignments
        ?.map(a => ({
          id: (a.agents as any).id,
          name: (a.agents as any).name,
          provider: (a.agents as any).provider,
          sort_order: a.sort_order
        }))
        .filter(a => a.id) || [];

      setAgents(agentsList);

      if (agentsList.length > 0) {
        setSelectedAgentId(agentsList[0].id);
        
        // Load default permissions for preview mode
        const { data: clientSettings } = await supabase
          .from('client_settings')
          .select('default_user_permissions')
          .eq('client_id', previewClientId)
          .single();
        
        if (clientSettings?.default_user_permissions) {
          setSelectedAgentPermissions(clientSettings.default_user_permissions as unknown as AgentPermissions);
        } else {
          setSelectedAgentPermissions({
            analytics: true,
            conversations: true,
            knowledge_base: false,
            agent_settings: false,
          });
        }
      }
    } catch (error) {
      console.error('Error loading client agents for preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClientAgents = async () => {
    try {
      // First, get the client_id for this user
      const { data: clientUserData, error: clientUserError } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (clientUserError) throw clientUserError;
      
      if (!clientUserData) {
        console.log('No client association found for user');
        setLoading(false);
        return;
      }

      setClientId(clientUserData.client_id);

      // Get agents user has permission to see
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('client_user_agent_permissions')
        .select(`
          agent_id,
          permissions,
          agents (
            id,
            name,
            provider
          )
        `)
        .eq('user_id', user!.id)
        .eq('client_id', clientUserData.client_id);

      if (permissionsError) throw permissionsError;

      // Get sort order from agent_assignments
      const { data: assignments } = await supabase
        .from('agent_assignments')
        .select('agent_id, sort_order')
        .eq('client_id', clientUserData.client_id)
        .order('sort_order', { ascending: true });

      // Map agents with sort order
      const sortOrderMap = new Map(assignments?.map(a => [a.agent_id, a.sort_order]) || []);
      
      const agentsList = permissionsData
        ?.map(p => ({
          id: (p.agents as any).id,
          name: (p.agents as any).name,
          provider: (p.agents as any).provider,
          sort_order: sortOrderMap.get((p.agents as any).id) || 999,
          permissions: p.permissions as unknown as AgentPermissions,
        }))
        .filter(a => a.id)
        .sort((a, b) => a.sort_order - b.sort_order) || [];

      setAgents(agentsList.map(({ permissions, ...agent }) => agent));

      // Auto-select the highest priority agent (first in list)
      if (agentsList.length > 0) {
        setSelectedAgentId(agentsList[0].id);
        setSelectedAgentPermissions(agentsList[0].permissions);
      }
    } catch (error) {
      console.error('Error loading client agents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update permissions when selected agent changes
  useEffect(() => {
    if (selectedAgentId && user && clientId && profile?.role === 'client') {
      const loadAgentPermissions = async () => {
        const { data } = await supabase
          .from('client_user_agent_permissions')
          .select('permissions')
          .eq('user_id', user.id)
          .eq('agent_id', selectedAgentId)
          .eq('client_id', clientId)
          .single();
        
        if (data) {
          setSelectedAgentPermissions(data.permissions as unknown as AgentPermissions);
        }
      };
      loadAgentPermissions();
    }
  }, [selectedAgentId, user, clientId, profile]);

  return (
    <ClientAgentContext.Provider
      value={{
        agents,
        selectedAgentId,
        setSelectedAgentId,
        selectedAgentPermissions,
        loading,
        clientId,
      }}
    >
      {children}
    </ClientAgentContext.Provider>
  );
}

export function useClientAgentContext() {
  const context = useContext(ClientAgentContext);
  if (context === undefined) {
    throw new Error('useClientAgentContext must be used within a ClientAgentProvider');
  }
  return context;
}