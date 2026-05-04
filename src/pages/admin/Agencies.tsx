import { useEffect, useState } from "react";
import { TableSkeleton } from "@/components/skeletons";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Calendar, ArrowRight, Settings, Eye } from "lucide-react";
import { toast } from "sonner";
import { useImpersonation } from "@/hooks/useImpersonation";

interface Agency {
  id: string;
  name: string;
  slug: string;
  logo_light_url?: string;
  logo_dark_url?: string;
  full_logo_light_url?: string;
  full_logo_dark_url?: string;
  support_email: string | null;
  is_active: boolean;
  created_at: string;
  trial_ends_at: string | null;
  owner_id: string;
  subscription?: {
    status: string;
    plan: {
      name: string;
      price_cents: number;
    };
    current_clients: number;
    current_agents: number;
  };
}

export default function Agencies() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { startImpersonation } = useImpersonation();

  useEffect(() => {
    loadAgencies();
  }, []);

  const getHttpStatus = (err: any): number | null => {
    if (!err) return null;
    if (typeof err.status === 'number') return err.status;
    if (err.context?.status) return err.context.status;
    if (err.message?.includes('401')) return 401;
    if (err.message?.includes('403')) return 403;
    return null;
  };

      const loadAgencies = async (retrying = false) => {
    try {

      const { data, error } = await supabase.functions.invoke('get-agencies-overview');

      if (error) {
        console.error("Edge function error:", error);
        const status = getHttpStatus(error);
        
        // Retry once on 401 by refreshing session
        if (!retrying && status === 401) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error("Session refresh failed:", refreshError);
            toast.error("Session expired. Please log in again.");
            return;
          }
          return loadAgencies(true);
        }
        
        throw error;
      }

      setAgencies(data?.agencies || []);
    } catch (error: any) {
      toast.error("Failed to load agencies");
      console.error("Load agencies error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (agency: Agency) => {
    if (!agency.is_active) {
      return <Badge variant="destructive">Inactive</Badge>;
    }
    
    const subscription = agency.subscription;
    if (!subscription) {
      return <Badge variant="secondary">No Subscription</Badge>;
    }

    switch (subscription.status) {
      case 'trialing':
        return <Badge variant="secondary">Trial</Badge>;
      case 'active':
        return <Badge className="bg-sage-bg text-sage-fg hover:bg-sage-bg-2">Active</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Past Due</Badge>;
      case 'canceled':
        return <Badge variant="outline">Canceled</Badge>;
      default:
        return <Badge variant="secondary">{subscription.status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Agencies</h1>
          <p className="text-sm text-muted-foreground">Manage all agencies on your platform</p>
        </div>
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Agencies</h1>
          <p className="text-sm text-muted-foreground">Manage all agencies on your platform</p>
        </div>
        <div className="text-sm text-muted-foreground">
          Total: {agencies.length} {agencies.length === 1 ? 'agency' : 'agencies'}
        </div>
      </div>

      <div className="space-y-3">
        {agencies.map((agency) => {
          const subscription = agency.subscription;
          
          return (
            <Card key={agency.id} className="w-full hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                {/* Row 1: Logo | Agency Name | Status | Plan | Preview Button */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {/* Logo */}
                    {(agency.logo_light_url || agency.logo_dark_url) ? (
                      <img
                        src={agency.logo_light_url || agency.logo_dark_url || ''}
                        alt={agency.name}
                        className="w-10 h-10 rounded-lg object-contain"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    
                    {/* Agency Name */}
                    <h3 className="text-lg font-semibold">{agency.name}</h3>
                    
                    {/* Status Badge */}
                    {getStatusBadge(agency)}
                    
                    {/* Separator */}
                    <Separator orientation="vertical" className="h-6" />
                    
                    {/* Plan */}
                    <div className="text-sm">
                      <span className="text-muted-foreground">Plan: </span>
                      <span className="font-medium">{subscription?.plan?.name || 'No Plan'}</span>
                    </div>
                  </div>
                  
                  {/* Preview Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await startImpersonation({
                          targetType: 'agency',
                          agencyId: agency.id,
                        });
                        window.location.href = '/agency/clients';
                      } catch (e: any) {
                        toast.error(e.message || 'Failed to impersonate agency');
                      }
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View as
                  </Button>
                </div>
                
                {/* Row 2: Clients | Agents | MRR | Settings Button */}
                <div className="flex items-center justify-between pl-[52px]">
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div>
                      Clients: <span className="font-medium text-foreground">
                        {subscription?.current_clients || 0}
                      </span>
                    </div>
                    <div>
                      Agents: <span className="font-medium text-foreground">
                        {subscription?.current_agents || 0}
                      </span>
                    </div>
                    <div>
                      MRR: <span className="font-medium text-foreground">
                        ${((subscription?.plan?.price_cents || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Settings Button */}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => navigate(`/admin/agencies/${agency.id}`)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {agencies.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No agencies yet</p>
            <p className="text-sm text-muted-foreground">
              Agencies will appear here once they sign up
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
