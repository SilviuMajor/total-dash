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

interface ClientAgentContextType {
  agents: Agent[];
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string) => void;
  loading: boolean;
  clientId: string | null;
}

const ClientAgentContext = createContext<ClientAgentContextType | undefined>(undefined);

export function ClientAgentProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
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

      if (agentsList.length > 0 && !selectedAgentId) {
        setSelectedAgentId(agentsList[0].id);
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

      // Get agents assigned to this client, ordered by priority
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
        .eq('client_id', clientUserData.client_id)
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

      // Auto-select the highest priority agent (first in list)
      if (agentsList.length > 0 && !selectedAgentId) {
        setSelectedAgentId(agentsList[0].id);
      }
    } catch (error) {
      console.error('Error loading client agents:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClientAgentContext.Provider
      value={{
        agents,
        selectedAgentId,
        setSelectedAgentId,
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