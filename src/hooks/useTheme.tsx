import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type Theme = 'light' | 'dark' | 'system';
type EffectiveTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  effectiveTheme: EffectiveTheme;
  setTheme: (theme: EffectiveTheme) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  effectiveTheme: 'light',
  setTheme: async () => {},
  isLoading: true,
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [theme, setThemeState] = useState<Theme>('light');
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>('light');
  const [isLoading, setIsLoading] = useState(true);
  const [systemIsDark, setSystemIsDark] = useState(false);

  // Detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemIsDark(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Load theme from profile on mount and when profile changes
  useEffect(() => {
    if (profile?.id) {
      const savedTheme = (profile as any).theme_preference as Theme | undefined;
      const userTheme = savedTheme || 'light';
      setThemeState(userTheme);
      
      // System mode now properly resolves to actual system preference
      const resolved: EffectiveTheme = userTheme === 'system' 
        ? (systemIsDark ? 'dark' : 'light')
        : userTheme;
      setEffectiveTheme(resolved);
      setIsLoading(false);
    } else {
      // Not logged in, default to light
      setThemeState('light');
      setEffectiveTheme('light');
      setIsLoading(false);
    }
  }, [profile, systemIsDark]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [effectiveTheme, systemIsDark]);

  const setTheme = async (newTheme: EffectiveTheme) => {
    if (!user?.id) return;

    // Optimistic update
    setThemeState(newTheme);
    setEffectiveTheme(newTheme);

    // Save to database
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ theme_preference: newTheme })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving theme preference:', error);
        // Revert on error
        const savedTheme = (profile as any)?.theme_preference as Theme || 'light';
        setThemeState(savedTheme);
        setEffectiveTheme(savedTheme === 'system' ? 'light' : savedTheme);
      }
    } catch (error) {
      console.error('Error updating theme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}
