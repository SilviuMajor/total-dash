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
    agencyName?: string;
    clientName?: string;
  }) => Promise<void>;
  endImpersonation: () => Promise<void>;
  exitAll: () => Promise<void>;
  exitToParent: () => Promise<void>;
  switchTarget: (targetUserId: string | null) => Promise<void>;
  backToAgency: () => Promise<string | null>;
  getReturnUrl: () => string | null;
  setReturnUrl: (url: string) => void;
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
  backToAgency: async () => null,
  getReturnUrl: () => null,
  setReturnUrl: () => {},
});

const SESSION_STORAGE_KEY = 'impersonation_session_id';

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<ImpersonationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [clientUsers, setClientUsers] = useState<ImpersonationContextType['clientUsers']>([]);

  const cleanupStaleSession = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    const hadBridgeValues = sessionStorage.getItem('preview_mode');
    sessionStorage.removeItem('preview_mode');
    sessionStorage.removeItem('preview_client');
    sessionStorage.removeItem('preview_client_agency');
    sessionStorage.removeItem('preview_agency');
    sessionStorage.removeItem('preview_token');
    sessionStorage.removeItem('preview_agency_name');
    sessionStorage.removeItem('preview_client_name');
    sessionStorage.removeItem('impersonation_return_url');
    // If we cleaned up bridge values, notify useMultiTenantAuth to reset
    if (hadBridgeValues) {
      window.dispatchEvent(new Event('impersonation-changed'));
    }
  };

  // Restore session on mount and when user changes
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // CRITICAL: Reset loading to true when user becomes available
    // Without this, the first run (user=null) sets loading=false,
    // and the second run (user=valid) starts restoreSession async
    // but loading is already false — route guards proceed too early
    setLoading(true);

    const restoreSession = async () => {
      try {
        const currentPath = window.location.pathname;
        const isOnAdminRoute = currentPath.startsWith('/admin');
        const storedSessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
        const hasBridgeValues = !!sessionStorage.getItem('preview_mode');

        

        if (!storedSessionId && !hasBridgeValues) {
          
          return;
        }

        if (!storedSessionId && hasBridgeValues) {
          // DevSwitch sets bridge values without a DB session — don't clean those up
          const isDevSwitch = sessionStorage.getItem('dev_switch_active') === 'true';
          if (!isDevSwitch) {
            cleanupStaleSession();
          }
          return;
        }

        
        const { data, error } = await supabase
          .from('impersonation_sessions')
          .select('*')
          .eq('id', storedSessionId!)
          .eq('actor_id', user.id)
          .is('ended_at', null)
          .maybeSingle();

        

        if (!data || error) {
          
          cleanupStaleSession();
        } else if (isOnAdminRoute) {
          
          try {
            await supabase.functions.invoke('end-impersonation', {
              body: { sessionId: data.id },
            });
          } catch (e) {
            await supabase
              .from('impersonation_sessions')
              .update({ ended_at: new Date().toISOString() })
              .eq('id', data.id);
          }
          cleanupStaleSession();
        } else {
          
          setActiveSession(data as ImpersonationSession);
          if (data.client_id) loadClientUsers(data.client_id);
        }
      } catch (error) {
        console.error('Impersonation restore error:', error);
        cleanupStaleSession();
      } finally {
        
        setLoading(false);
      }
    };

    // Safety timeout — if restore takes more than 4 seconds, force loading to false
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 4000);

    restoreSession().finally(() => clearTimeout(timeout));
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
  }, [elapsedMinutes, activeSession, endImpersonation]);



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
    agencyName?: string;
    clientName?: string;
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
      if (params.targetType === 'agency' && params.agencyId) {
        sessionStorage.setItem('preview_mode', 'agency');
        sessionStorage.setItem('preview_agency', params.agencyId);
        if (params.agencyName) {
          sessionStorage.setItem('preview_agency_name', params.agencyName);
        }
        // Clear any client preview values
        sessionStorage.removeItem('preview_client');
        sessionStorage.removeItem('preview_client_agency');
        sessionStorage.removeItem('preview_client_name');
      } else if (params.clientId) {
        sessionStorage.setItem('preview_mode', 'client');
        sessionStorage.setItem('preview_client', params.clientId);
        if (params.agencyId) {
          sessionStorage.setItem('preview_client_agency', params.agencyId);
        }
        if (params.clientName) {
          sessionStorage.setItem('preview_client_name', params.clientName);
        }
        // Clear agency preview values
        sessionStorage.removeItem('preview_agency');
        sessionStorage.removeItem('preview_agency_name');
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

      await supabase.functions.invoke('end-impersonation', {
        body: { sessionId: activeSession.id },
      });

      setActiveSession(null);
      setClientUsers([]);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);

      // Bridge: clear old preview mode sessionStorage values
      sessionStorage.removeItem('preview_mode');
      sessionStorage.removeItem('preview_client');
      sessionStorage.removeItem('preview_client_agency');
      sessionStorage.removeItem('preview_agency');
      sessionStorage.removeItem('preview_token');
      sessionStorage.removeItem('impersonation_return_url');

      // Trigger re-read in useMultiTenantAuth
      window.dispatchEvent(new Event('impersonation-changed'));
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

      // Bridge: clear old preview mode sessionStorage values
      sessionStorage.removeItem('preview_mode');
      sessionStorage.removeItem('preview_client');
      sessionStorage.removeItem('preview_client_agency');
      sessionStorage.removeItem('preview_agency');
      sessionStorage.removeItem('preview_token');
      sessionStorage.removeItem('impersonation_return_url');

      // Trigger re-read in useMultiTenantAuth
      window.dispatchEvent(new Event('impersonation-changed'));
    } catch (error) {
      console.error('Failed to exit all impersonation:', error);
    }
  }, []);

  const exitToParent = useCallback(async () => {
    await endImpersonation();
  }, [endImpersonation]);

  const getReturnUrl = useCallback((): string | null => {
    return sessionStorage.getItem('impersonation_return_url');
  }, []);

  const setReturnUrl = useCallback((url: string) => {
    sessionStorage.setItem('impersonation_return_url', url);
  }, []);

  const backToAgency = useCallback(async (): Promise<string | null> => {
    try {
      if (!activeSession) return null;

      const agencyId = activeSession.agency_id;

      await supabase.functions.invoke('end-impersonation', {
        body: { sessionId: activeSession.id },
      });

      if (!agencyId) {
        setActiveSession(null);
        setClientUsers([]);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        sessionStorage.removeItem('preview_mode');
        sessionStorage.removeItem('preview_client');
        sessionStorage.removeItem('preview_client_agency');
        sessionStorage.removeItem('preview_agency');
        sessionStorage.removeItem('preview_token');
        sessionStorage.removeItem('impersonation_return_url');
        window.dispatchEvent(new Event('impersonation-changed'));
        return null;
      }

      const { data, error } = await supabase.functions.invoke('start-impersonation', {
        body: {
          targetType: 'agency',
          agencyId,
        },
      });

      if (error || !data?.success) {
        console.error('Failed to start agency session:', error || data?.error);
        setActiveSession(null);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }

      setActiveSession(data.session as ImpersonationSession);
      sessionStorage.setItem(SESSION_STORAGE_KEY, data.session.id);
      setClientUsers([]);

      sessionStorage.setItem('preview_mode', 'agency');
      sessionStorage.setItem('preview_agency', agencyId);
      sessionStorage.removeItem('preview_client');
      sessionStorage.removeItem('preview_client_agency');
      sessionStorage.removeItem('impersonation_return_url');

      window.dispatchEvent(new Event('impersonation-changed'));

      return agencyId;
    } catch (error) {
      console.error('Failed to go back to agency:', error);
      return null;
    }
  }, [activeSession]);

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
        backToAgency,
        getReturnUrl,
        setReturnUrl,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  return useContext(ImpersonationContext);
}
