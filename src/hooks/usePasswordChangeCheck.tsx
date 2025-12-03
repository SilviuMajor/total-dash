import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export function usePasswordChangeCheck() {
  const [checking, setChecking] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkPasswordChangeRequired = async () => {
      // Skip check if already on change-password page
      if (location.pathname === '/change-password') {
        setChecking(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setChecking(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('check-must-change-password', {
          body: {}
        });

        if (error) {
          console.error('Error checking password change requirement:', error);
          setChecking(false);
          return;
        }

        if (data?.mustChangePassword) {
          setMustChangePassword(true);
          navigate('/change-password', { replace: true });
        }
      } catch (error) {
        console.error('Error in password change check:', error);
      } finally {
        setChecking(false);
      }
    };

    checkPasswordChangeRequired();
  }, [navigate, location.pathname]);

  return { checking, mustChangePassword };
}
