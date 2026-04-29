import { supabase } from "@/integrations/supabase/client";

export async function signUp(email: string, password: string, fullName: string, role: 'admin' | 'client' = 'client') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,
      },
      emailRedirectTo: `${window.location.origin}/`,
    },
  });
  
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

export async function getUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { profile: null, error: new Error('Not authenticated') };

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { profile, error };
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/change-password`,
  });

  return { error };
}

export type DetectedUserType =
  | { type: 'super_admin' }
  | { type: 'agency'; agencyId: string }
  | { type: 'client'; clientId: string; clientSlug: string | null; agencySlug: string | null }
  | { type: 'unknown' };

// Resolves which role table a user belongs to. Mirrors loadProfile() priority
// in useMultiTenantAuth (super_admin > agency > client). Used by login pages
// (post-sign-in role check) and route guards (mismatch redirect).
export async function detectUserTypeAfterAuth(userId: string): Promise<DetectedUserType> {
  const [superRes, agencyRes, clientRes] = await Promise.all([
    supabase.from('super_admin_users').select('user_id').eq('user_id', userId).maybeSingle(),
    supabase.from('agency_users').select('agency_id').eq('user_id', userId).limit(1),
    supabase
      .from('client_users')
      .select('client_id, clients:client_id(slug, agency:agency_id(slug))')
      .eq('user_id', userId)
      .limit(1),
  ]);

  if (superRes.data) return { type: 'super_admin' };
  if (agencyRes.data?.[0]) return { type: 'agency', agencyId: agencyRes.data[0].agency_id };
  if (clientRes.data?.[0]) {
    const row: any = clientRes.data[0];
    return {
      type: 'client',
      clientId: row.client_id,
      clientSlug: row.clients?.slug ?? null,
      agencySlug: row.clients?.agency?.slug ?? null,
    };
  }
  return { type: 'unknown' };
}

export function loginPathForUserType(t: DetectedUserType): string {
  switch (t.type) {
    case 'super_admin': return '/admin/login';
    case 'agency': return '/agency/login';
    case 'client':
      if (t.agencySlug && t.clientSlug) return `/login/${t.agencySlug}/${t.clientSlug}`;
      if (t.agencySlug) return `/login/${t.agencySlug}`;
      return '/auth';
    default: return '/auth';
  }
}

export function dashboardPathForUserType(t: DetectedUserType): string {
  switch (t.type) {
    case 'super_admin': return '/admin/agencies';
    case 'agency': return '/agency';
    case 'client': return '/conversations';
    default: return '/auth';
  }
}

export function userTypeLabel(t: DetectedUserType): string {
  switch (t.type) {
    case 'super_admin': return 'super admin';
    case 'agency': return 'agency';
    case 'client': return 'client';
    default: return 'user';
  }
}
