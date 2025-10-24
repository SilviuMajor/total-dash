import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type UserType = 'super_admin' | 'agency' | 'client' | null;

interface AgencyData {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  has_whitelabel_access: boolean;
}

interface MultiTenantProfile {
  id: string;
  email: string;
  full_name: string | null;
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
  signOut: () => Promise<void>;
  isPreviewMode: boolean;
  previewAgency: AgencyData | null;
}

const MultiTenantAuthContext = createContext<MultiTenantAuthContextType>({
  user: null,
  session: null,
  profile: null,
  userType: null,
  loading: true,
  signOut: async () => {},
  isPreviewMode: false,
  previewAgency: null,
});

export const useMultiTenantAuth = () => useContext(MultiTenantAuthContext);

export function MultiTenantAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MultiTenantProfile | null>(null);
  const [userType, setUserType] = useState<UserType>(null);
  const [loading, setLoading] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewAgency, setPreviewAgency] = useState<AgencyData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for preview mode
    const searchParams = new URLSearchParams(window.location.search);
    const previewParam = searchParams.get('preview') === 'true';
    const agencyId = searchParams.get('agencyId');
    
    setIsPreviewMode(previewParam && !!agencyId);
    
    if (previewParam && agencyId) {
      loadPreviewAgency(agencyId);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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

    return () => subscription.unsubscribe();
  }, []);

  const loadPreviewAgency = async (agencyId: string) => {
    try {
      const { data: agencyData } = await supabase
        .from('agencies')
        .select('id, name, slug, logo_url')
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
            logo_url
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
    await supabase.auth.signOut();
    
    // Redirect based on current path
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/super-admin')) {
      navigate('/super-admin/login');
    } else if (currentPath.startsWith('/agency')) {
      navigate('/agency/login');
    } else {
      navigate('/auth');
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
        signOut: handleSignOut,
        isPreviewMode,
        previewAgency,
      }}
    >
      {children}
    </MultiTenantAuthContext.Provider>
  );
}
