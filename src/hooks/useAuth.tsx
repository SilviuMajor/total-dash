import { useMultiTenantAuth } from './useMultiTenantAuth';
import { ReactNode } from 'react';

export function useAuth() {
  const { user, session, profile, loading, signOut } = useMultiTenantAuth();
  return { user, session, profile, loading, signOut };
}

// No-op passthrough so existing imports of AuthProvider don't break
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
