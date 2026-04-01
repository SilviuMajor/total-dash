import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ImpersonationSession {
  id: string;
  actor_id: string;
  actor_type: string;
  actor_name: string;
  target_type: string;
  target_user_id: string | null;
  target_user_name: string | null;
  agency_id: string | null;
  client_id: string | null;
  parent_session_id: string | null;
  mode: 'full_access' | 'view_as_user';
  started_at: string;
}

interface ImpersonationContextType {
  // State
  isImpersonating: boolean;
  activeSession: ImpersonationSession | null;
  impersonationMode: 'full_access' | 'view_as_user' | null;
  targetUserId: string | null;
  targetUserName: string | null;
  targetClientId: string | null;
  targetAgencyId: string | null;
  elapsedMinutes: number;
  loading: boolean;
  
  // Client users for the switcher dropdown
  clientUsers: { id: string; user_id: string; full_name: string; role_name: string; department_name: string | null }[];

  // Actions
  startImpersonation: (params: {
    targetType: string;
    targetUserId?: string;
    agencyId?: string;
    clientId?: string;
    parentSessionId?: string;
  }) => Promise<void>;
  endImpersonation: () => Promise<void>;
  exitAll: () => Promise<void>;
  exitToParent: () => Promise<void>;
  switchTarget: (targetUserId: string | null) => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextType>({
  isImpersonating: false,
  activeSession: null,
  impersonationMode: null,
  targetUserId: null,
  targetUserName: null,
  targetClientId: null,
  targetAgencyId: null,
  elapsedMinutes: 0,
  loading: true,
  clientUsers: [],
  startImpersonation: async () => {},
  endImpersonation: async () => {},
  exitAll: async () => {},
  exitToParent: async () => {},
  switchTarget: async () => {},
});

const SESSION_STORAGE_KEY = 'impersonation_session_id';

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<ImpersonationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [clientUsers, setClientUsers] = useState<ImpersonationContextType['clientUsers']>([]);

  // Restore session on mount
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const restoreSession = async () => {
      try {
        const storedSessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);

        if (storedSessionId) {
          // Try to restore from stored session ID
          const { data, error } = await supabase
            .from('impersonation_sessions')
            .select('*')
            .eq('id', storedSessionId)
            .eq('actor_id', user.id)
            .is('ended_at', null)
            .maybeSingle();

          if (data && !error) {
            setActiveSession(data as ImpersonationSession);
            if (data.client_id) loadClientUsers(data.client_id);
          } else {
            // Session expired or invalid — clean up
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
          }
        } else {
          // Check for any active session in DB (e.g. from another tab)
          const { data } = await supabase
            .from('impersonation_sessions')
            .select('*')
            .eq('actor_id', user.id)
            .is('ended_at', null)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (data) {
            setActiveSession(data as ImpersonationSession);
            sessionStorage.setItem(SESSION_STORAGE_KEY, data.id);
            if (data.client_id) loadClientUsers(data.client_id);
          }
        }
      } catch (error) {
        console.error('Error restoring impersonation session:', error);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [user]);

  // Elapsed time timer
  useEffect(() => {
    if (!activeSession) {
      setElapsedMinutes(0);
      return;
    }

    const updateElapsed = () => {
      const started = new Date(activeSession.started_at).getTime();
      const now = Date.now();
      setElapsedMinutes(Math.floor((now - started) / 60000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 60000);
    return () => clearInterval(interval);
  }, [activeSession?.id]);

  // Auto-timeout: close sessions older than 4 hours
  useEffect(() => {
    if (elapsedMinutes >= 240 && activeSession) {
      endImpersonation();
    }
  }, [elapsedMinutes]);

  const loadClientUsers = async (clientId: string) => {
    const { data } = await supabase
      .from('client_users')
      .select(`
        id, user_id, full_name,
        client_user_agent_permissions!inner(role_id),
        departments(name)
      `)
      .eq('client_id', clientId);

    if (!data) return;

    // Get role names
    const roleIds = [...new Set(data.flatMap((u: any) =>
      (u.client_user_agent_permissions || []).map((p: any) => p.role_id).filter(Boolean)
    ))];

    let roleMap: Record<string, string> = {};
    if (roleIds.length > 0) {
      const { data: roles } = await supabase
        .from('client_roles')
        .select('id, name')
        .in('id', roleIds);
      (roles || []).forEach((r: any) => { roleMap[r.id] = r.name; });
    }

    const users = data.map((u: any) => {
      const roleId = u.client_user_agent_permissions?.[0]?.role_id;
      return {
        id: u.id,
        user_id: u.user_id,
        full_name: u.full_name || 'Unnamed',
        role_name: roleId ? (roleMap[roleId] || 'Unknown') : 'Unknown',
        department_name: u.departments?.name || null,
      };
    });

    setClientUsers(users);
  };

  const startImpersonation = useCallback(async (params: {
    targetType: string;
    targetUserId?: string;
    agencyId?: string;
    clientId?: string;
    parentSessionId?: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('start-impersonation', {
        body: {
          targetType: params.targetType,
          targetUserId: params.targetUserId || null,
          agencyId: params.agencyId || null,
          clientId: params.clientId || null,
          parentSessionId: params.parentSessionId || null,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setActiveSession(data.session as ImpersonationSession);
      sessionStorage.setItem(SESSION_STORAGE_KEY, data.session.id);

      // Bridge: set old preview mode sessionStorage values so existing components work
      if (params.clientId) {
        sessionStorage.setItem('preview_mode', 'client');
        sessionStorage.setItem('preview_client', params.clientId);
        if (params.agencyId) {
          sessionStorage.setItem('preview_client_agency', params.agencyId);
        }
      }

      if (params.clientId) {
        loadClientUsers(params.clientId);
      }

      // Trigger re-read in useMultiTenantAuth by dispatching a custom event
      window.dispatchEvent(new Event('impersonation-changed'));
    } catch (error) {
      console.error('Failed to start impersonation:', error);
      throw error;
    }
  }, []);

  const endImpersonation = useCallback(async () => {
    try {
      if (!activeSession) return;

      // If this session has a parent, restore the parent
      const parentId = activeSession.parent_session_id;

      await supabase.functions.invoke('end-impersonation', {
        body: { sessionId: activeSession.id },
      });

      if (parentId) {
        // Restore parent session
        const { data } = await supabase
          .from('impersonation_sessions')
          .select('*')
          .eq('id', parentId)
          .is('ended_at', null)
          .maybeSingle();

        if (data) {
          setActiveSession(data as ImpersonationSession);
          sessionStorage.setItem(SESSION_STORAGE_KEY, data.id);
          if (data.client_id) loadClientUsers(data.client_id);
          else setClientUsers([]);
          return;
        }
      }

      setActiveSession(null);
      setClientUsers([]);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to end impersonation:', error);
    }
  }, [activeSession]);

  const exitAll = useCallback(async () => {
    try {
      await supabase.functions.invoke('end-impersonation', {
        body: { endAll: true },
      });

      setActiveSession(null);
      setClientUsers([]);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to exit all impersonation:', error);
    }
  }, []);

  const exitToParent = useCallback(async () => {
    // Same as endImpersonation — it handles parent restoration
    await endImpersonation();
  }, [endImpersonation]);

  const switchTarget = useCallback(async (targetUserId: string | null) => {
    try {
      if (!activeSession) return;

      const { data, error } = await supabase.functions.invoke('switch-impersonation-target', {
        body: {
          sessionId: activeSession.id,
          targetUserId: targetUserId || null,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setActiveSession(data.session as ImpersonationSession);
    } catch (error) {
      console.error('Failed to switch impersonation target:', error);
    }
  }, [activeSession]);

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating: !!activeSession,
        activeSession,
        impersonationMode: activeSession?.mode || null,
        targetUserId: activeSession?.target_user_id || null,
        targetUserName: activeSession?.target_user_name || null,
        targetClientId: activeSession?.client_id || null,
        targetAgencyId: activeSession?.agency_id || null,
        elapsedMinutes,
        loading,
        clientUsers,
        startImpersonation,
        endImpersonation,
        exitAll,
        exitToParent,
        switchTarget,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  return useContext(ImpersonationContext);
}
