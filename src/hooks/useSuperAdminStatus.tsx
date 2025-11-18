import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useSuperAdminStatus() {
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          if (!cancelled) {
            setIsSuperAdmin(false);
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase.rpc('is_super_admin', { 
          _user_id: user.id 
        });

        if (!cancelled) {
          setIsSuperAdmin(!!data && !error);
          setLoading(false);
        }
      } catch (err) {
        console.error('[useSuperAdminStatus] Error:', err);
        if (!cancelled) {
          setIsSuperAdmin(false);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isSuperAdmin, loading };
}
