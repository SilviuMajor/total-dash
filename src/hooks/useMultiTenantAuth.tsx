import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";

// Session storage keys for preview mode persistence
const PREVIEW_MODE_KEY = 'preview_mode';
const PREVIEW_AGENCY_KEY = 'preview_agency';
const PREVIEW_CLIENT_KEY = 'preview_client';
const PREVIEW_CLIENT_AGENCY_KEY = 'preview_client_agency';

type UserType = 'super_admin' | 'agency' | 'client' | null;
type PreviewDepth = 'none' | 'agency' | 'client' | 'agency_to_client';

interface AgencyData {
  id: string;
  name: string;
  slug: string;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  has_whitelabel_access: boolean;
}

interface MultiTenantProfile {
  id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'client';
  user_type: UserType;
  agency?: AgencyData;
}

interface MultiTenantAuthContextType {
  user: User | null;
  session: Session | null;
  profile: MultiTenantProfile | null;
  userType: UserType;
  loading: boolean;
  isValidatingToken: boolean;
  signOut: () => Promise<void>;
  isPreviewMode: boolean;
  previewAgency: AgencyData | null;
  isClientPreviewMode: boolean;
  previewClient: { id: string; name: string; logo_url: string | null } | null;
  previewClientAgencyId: string | null;
  previewDepth: PreviewDepth;
  isProcessingPreviewParams: boolean;
}

const MultiTenantAuthContext = createContext<MultiTenantAuthContextType>({
  user: null,
  session: null,
  profile: null,
  userType: null,
  loading: true,
  isValidatingToken: false,
  signOut: async () => {},
  isPreviewMode: false,
  previewAgency: null,
  isClientPreviewMode: false,
  previewClient: null,
  previewClientAgencyId: null,
  previewDepth: 'none',
  isProcessingPreviewParams: false,
});

export const useMultiTenantAuth = () => useContext(MultiTenantAuthContext);

export function MultiTenantAuthProvider({ children }: { children: ReactNode }) {
  // Check for token IMMEDIATELY on mount to set validating state synchronously
  const searchParams = new URLSearchParams(window.location.search);
  const tokenParam = searchParams.get('token');
  const sessionToken = sessionStorage.getItem('preview_token');
  const hasToken = tokenParam || sessionToken;

  // Synchronous initialization of preview depth from URL params OR sessionStorage
  let initialPreviewMode: PreviewDepth = 'none';
  let initialIsClientPreviewMode = false;
  let initialIsPreviewMode = false;
  let hasPreviewUrlParams = false;

  if (typeof window !== 'undefined') {
    const searchParams = new URLSearchParams(window.location.search);
    const previewParam = searchParams.get('preview') === 'true';
    const urlAgencyId = searchParams.get('agencyId');
    const urlClientId = searchParams.get('clientId');

    // Check URL params FIRST (highest priority for first-time navigation)
    if (previewParam && urlClientId && urlAgencyId) {
      hasPreviewUrlParams = true;
      const storedPreviewAgency = sessionStorage.getItem(PREVIEW_AGENCY_KEY);
      initialPreviewMode = storedPreviewAgency ? 'agency_to_client' : 'client';
      initialIsClientPreviewMode = true;
      initialIsPreviewMode = !!storedPreviewAgency;
    } else if (previewParam && urlAgencyId && !urlClientId) {
      hasPreviewUrlParams = true;
      initialPreviewMode = 'agency';
      initialIsPreviewMode = true;
    } else {
      // Fall back to sessionStorage
      const storedPreviewMode = sessionStorage.getItem(PREVIEW_MODE_KEY);
      const storedPreviewAgency = sessionStorage.getItem(PREVIEW_AGENCY_KEY);
      const storedPreviewClient = sessionStorage.getItem(PREVIEW_CLIENT_KEY);

      if (storedPreviewMode === 'agency' && storedPreviewAgency) {
        initialPreviewMode = 'agency';
        initialIsPreviewMode = true;
      } else if (storedPreviewMode === 'client' && storedPreviewClient) {
        initialPreviewMode = storedPreviewAgency ? 'agency_to_client' : 'client';
        initialIsClientPreviewMode = true;
        initialIsPreviewMode = !!storedPreviewAgency;
      }
    }
  }

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MultiTenantProfile | null>(null);
  const [userType, setUserType] = useState<UserType>(null);
  const [loading, setLoading] = useState(true);
  const [isValidatingToken, setIsValidatingToken] = useState(!!hasToken);
  const [isPreviewMode, setIsPreviewMode] = useState(initialIsPreviewMode);
  const [previewAgency, setPreviewAgency] = useState<AgencyData | null>(null);
  const [isClientPreviewMode, setIsClientPreviewMode] = useState(initialIsClientPreviewMode);
  const [previewClient, setPreviewClient] = useState<{ id: string; name: string; logo_url: string | null } | null>(null);
  const [previewClientAgencyId, setPreviewClientAgencyId] = useState<string | null>(null);
  const [previewDepth, setPreviewDepth] = useState<PreviewDepth>(initialPreviewMode);
  const [isProcessingPreviewParams, setIsProcessingPreviewParams] = useState(hasPreviewUrlParams);
  const navigate = useNavigate();
  const location = useLocation();

  // Effect 1: Auth initialization - ALWAYS runs, never returns early
  useEffect(() => {
    console.log('[Auth] Initializing auth listener and session');
    
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[Auth] Auth state change:', _event, session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setUserType(null);
        setLoading(false);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[Auth] Initial session loaded:', session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // Only run once on mount

  // Effect 2: Preview token validation - runs when URL changes
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tokenParam = searchParams.get('token');

    // Handle token-based preview mode
    if (tokenParam) {
      setIsValidatingToken(true);
      console.log('[Preview] Token detected:', tokenParam);
      
      const validateToken = async () => {
        try {
          console.log('[Preview] Validation starting...');
          const { data: authContext, error } = await supabase
            .from('auth_contexts')
            .select('*')
            .eq('token', tokenParam)
            .eq('is_preview', true)
            .single();
          
          if (error || !authContext) {
            console.error('Invalid preview token:', error);
            navigate('/admin/agencies', { replace: true });
            setIsValidatingToken(false);
            return;
          }
          
          // Check if token has expired
          if (new Date(authContext.expires_at) < new Date()) {
            console.error('Preview session expired');
            navigate('/admin/agencies', { replace: true });
            setIsValidatingToken(false);
            return;
          }
          
          // Token is valid - set up preview mode
          if (authContext.context_type === 'agency' && authContext.agency_id) {
            setIsPreviewMode(true);
            setPreviewDepth('agency');
            console.log('[Preview] States set - isPreviewMode: true, previewDepth: agency');
            
            sessionStorage.setItem(PREVIEW_MODE_KEY, 'agency');
            sessionStorage.setItem(PREVIEW_AGENCY_KEY, authContext.agency_id);
            sessionStorage.setItem('preview_token', tokenParam);
            
            await loadPreviewAgency(authContext.agency_id);
            
            navigate('/agency/clients', { replace: true });
          }
        } catch (err) {
          console.error('Token validation error:', err);
          navigate('/admin/agencies', { replace: true });
        } finally {
          setIsValidatingToken(false);
        }
      };
      
      validateToken();
      return; // Skip other URL param checks for this effect
    }

    // Check sessionStorage first for preview mode persistence
    const storedPreviewMode = sessionStorage.getItem(PREVIEW_MODE_KEY);
    const storedPreviewAgency = sessionStorage.getItem(PREVIEW_AGENCY_KEY);
    const storedPreviewClient = sessionStorage.getItem(PREVIEW_CLIENT_KEY);
    const storedPreviewClientAgency = sessionStorage.getItem(PREVIEW_CLIENT_AGENCY_KEY);
    
    // Then check URL params (priority: URL > sessionStorage)
    const previewParam = searchParams.get('preview') === 'true';
    const agencyId = searchParams.get('agencyId');
    const clientId = searchParams.get('clientId');
    
    if (previewParam && agencyId && !clientId) {
      setIsPreviewMode(true);
      setPreviewDepth('agency');
      sessionStorage.setItem(PREVIEW_MODE_KEY, 'agency');
      sessionStorage.setItem(PREVIEW_AGENCY_KEY, agencyId);
      loadPreviewAgency(agencyId);
    } else if (previewParam && clientId && agencyId) {
      const hasAgencyPreview = sessionStorage.getItem(PREVIEW_AGENCY_KEY) !== null;
      setIsClientPreviewMode(true);
      setPreviewDepth(hasAgencyPreview ? 'agency_to_client' : 'client');
      sessionStorage.setItem(PREVIEW_MODE_KEY, 'client');
      sessionStorage.setItem(PREVIEW_CLIENT_KEY, clientId);
      sessionStorage.setItem(PREVIEW_CLIENT_AGENCY_KEY, agencyId);
      loadPreviewClient(clientId, agencyId);
      
      if (hasAgencyPreview) {
        const storedAgencyId = sessionStorage.getItem(PREVIEW_AGENCY_KEY);
        if (storedAgencyId) {
          setIsPreviewMode(true);
          loadPreviewAgency(storedAgencyId);
        }
      }
    } else if (storedPreviewMode === 'agency' && storedPreviewAgency) {
      const storedToken = sessionStorage.getItem('preview_token');
      
      if (storedToken) {
        const validateStoredToken = async () => {
          const { data: authContext } = await supabase
            .from('auth_contexts')
            .select('expires_at')
            .eq('token', storedToken)
            .single();
          
          if (!authContext || new Date(authContext.expires_at) < new Date()) {
            setIsPreviewMode(false);
            setPreviewDepth('none');
            sessionStorage.removeItem(PREVIEW_MODE_KEY);
            sessionStorage.removeItem(PREVIEW_AGENCY_KEY);
            sessionStorage.removeItem('preview_token');
            console.error('Preview session expired');
            navigate('/admin/agencies', { replace: true });
          } else {
            setIsPreviewMode(true);
            setPreviewDepth('agency');
            console.log('[Preview] Restoring from sessionStorage');
            loadPreviewAgency(storedPreviewAgency);
          }
        };
        
        validateStoredToken();
      } else {
        sessionStorage.removeItem(PREVIEW_MODE_KEY);
        sessionStorage.removeItem(PREVIEW_AGENCY_KEY);
      }
    } else if (storedPreviewMode === 'client' && storedPreviewClient && storedPreviewClientAgency) {
      setIsClientPreviewMode(true);
      const hasAgencyPreview = storedPreviewAgency !== null;
      setPreviewDepth(hasAgencyPreview ? 'agency_to_client' : 'client');
      loadPreviewClient(storedPreviewClient, storedPreviewClientAgency);
      
      if (hasAgencyPreview) {
        setIsPreviewMode(true);
        loadPreviewAgency(storedPreviewAgency);
      }
    } else if (!isClientPreviewMode && !isPreviewMode) {
      // Only reset if we're NOT already in preview mode
      setPreviewDepth('none');
    }
    
    // Mark preview param processing as complete
    setIsProcessingPreviewParams(false);
  }, [location.search]); // Run when URL search params change

  const loadPreviewAgency = async (agencyId: string) => {
    try {
      const { data: agencyData } = await supabase
        .from('agencies')
        .select('id, name, slug, logo_light_url, logo_dark_url')
        .eq('id', agencyId)
        .single();

      if (agencyData) {
        // Get whitelabel access
        const { data: subscriptionData } = await supabase
          .from('agency_subscriptions')
          .select(`
            subscription_plans:plan_id (
              has_whitelabel_access
            )
          `)
          .eq('agency_id', agencyId)
          .single();

        setPreviewAgency({
          ...agencyData,
          has_whitelabel_access: subscriptionData?.subscription_plans?.has_whitelabel_access || false,
        });
      }
    } catch (error) {
      console.error('Error loading preview agency:', error);
    }
  };

  const loadPreviewClient = async (clientId: string, agencyId: string) => {
    try {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name, logo_url, agency_id')
        .eq('id', clientId)
        .eq('agency_id', agencyId)
        .single();

      if (clientData) {
        setPreviewClient({
          id: clientData.id,
          name: clientData.name,
          logo_url: clientData.logo_url,
        });
        setPreviewClientAgencyId(agencyId);
      }
    } catch (error) {
      console.error('Error loading preview client:', error);
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      // Check if super admin
      const { data: superAdminData } = await supabase
        .from('super_admin_users')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (superAdminData) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        // If in preview mode, load preview agency as their agency context
        if (isPreviewMode && previewAgency) {
          setProfile({
            ...profileData,
            user_type: 'super_admin',
            agency: previewAgency,
          });
        } else {
          setProfile({
            ...profileData,
            user_type: 'super_admin',
          });
        }
        setUserType('super_admin');
        setLoading(false);
        return;
      }

      // Check if agency user
      const { data: agencyUserData } = await supabase
        .from('agency_users')
        .select(`
          *,
          agencies:agency_id (
            id,
            name,
            slug,
            logo_light_url,
            logo_dark_url
          )
        `)
        .eq('user_id', userId)
        .single();

      if (agencyUserData) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        // Get whitelabel access
        const { data: subscriptionData } = await supabase
          .from('agency_subscriptions')
          .select(`
            *,
            subscription_plans:plan_id (
              has_whitelabel_access
            )
          `)
          .eq('agency_id', agencyUserData.agency_id)
          .single();

        setProfile({
          ...profileData,
          user_type: 'agency',
          agency: {
            ...agencyUserData.agencies,
            has_whitelabel_access: subscriptionData?.subscription_plans?.has_whitelabel_access || false,
          },
        });
        setUserType('agency');
        setLoading(false);
        return;
      }

      // Default to client user
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileData) {
        setProfile({
          ...profileData,
          user_type: 'client',
        });
        setUserType('client');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    // Clean up preview token if exists
    const previewToken = sessionStorage.getItem('preview_token');
    if (previewToken) {
      try {
        // Delete the auth context token
        await supabase
          .from('auth_contexts')
          .delete()
          .eq('token', previewToken);
      } catch (error) {
        console.error('Failed to cleanup preview token:', error);
      }
    }
    
    await supabase.auth.signOut();
    
    // Clear preview mode from session storage
    sessionStorage.removeItem(PREVIEW_MODE_KEY);
    sessionStorage.removeItem(PREVIEW_AGENCY_KEY);
    sessionStorage.removeItem(PREVIEW_CLIENT_KEY);
    sessionStorage.removeItem(PREVIEW_CLIENT_AGENCY_KEY);
    sessionStorage.removeItem('preview_token');
    
    // Redirect based on current path
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/admin')) {
      navigate('/admin/login');
    } else if (currentPath.startsWith('/agency')) {
      navigate('/agency/login');
    } else {
      navigate('/client/login');
    }
  };

  return (
    <MultiTenantAuthContext.Provider
      value={{
        user,
        session,
        profile,
        userType,
        loading,
        isValidatingToken,
        signOut: handleSignOut,
        isPreviewMode,
        previewAgency,
        isClientPreviewMode,
        previewClient,
        previewClientAgencyId,
        previewDepth,
        isProcessingPreviewParams,
      }}
    >
      {children}
    </MultiTenantAuthContext.Provider>
  );
}
