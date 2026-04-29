import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClientAgentContext } from '@/hooks/useClientAgentContext';
import { useMultiTenantAuth } from '@/hooks/useMultiTenantAuth';

export interface ClientDepartment {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
  is_global?: boolean;
  sort_order?: number | null;
}

export function useClientDepartments() {
  const { clientId } = useClientAgentContext();
  const { isClientPreviewMode, previewClient } = useMultiTenantAuth();
  const [departments, setDepartments] = useState<ClientDepartment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const effectiveClientId =
        clientId || (isClientPreviewMode && previewClient?.id ? previewClient.id : null);
      if (!effectiveClientId) {
        if (!cancelled) setDepartments([]);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('departments')
        .select('id, name, code, color, is_global, sort_order')
        .eq('client_id', effectiveClientId)
        .is('deleted_at', null)
        .order('is_global', { ascending: false })
        .order('sort_order')
        .order('name');
      if (!cancelled) {
        setDepartments((data || []) as ClientDepartment[]);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [clientId, isClientPreviewMode, previewClient]);

  return { departments, loading };
}
