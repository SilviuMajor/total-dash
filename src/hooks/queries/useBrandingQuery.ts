import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useBrandingQuery(agencyId?: string) {
  return useQuery({
    queryKey: ['branding', agencyId || 'platform'],
    queryFn: async () => {
      const { data: platformData } = await supabase
        .from('platform_branding')
        .select('*')
        .maybeSingle();

      let agencyData = null;
      if (agencyId) {
        const { data } = await supabase
          .from('agencies')
          .select('logo_light_url, logo_dark_url, full_logo_light_url, full_logo_dark_url, favicon_light_url, favicon_dark_url, name')
          .eq('id', agencyId)
          .single();
        agencyData = data;
      }

      return { platformData, agencyData };
    },
    staleTime: 10 * 60_000,
  });
}
