import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Calendar, ArrowRight, Settings, Eye } from "lucide-react";
import { toast } from "sonner";

interface Agency {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
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

  useEffect(() => {
    loadAgencies();
  }, []);

  const loadAgencies = async () => {
    try {
      console.log("Loading agencies via edge function...");
      
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke('get-agencies-overview', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }

      console.log("Agencies loaded:", data?.agencies?.length || 0);
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
        return <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>;
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
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold">Agencies</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Agencies</h1>
          <p className="text-muted-foreground">Manage all agencies on your platform</p>
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
                    {agency.logo_url ? (
                      <img
                        src={agency.logo_url}
                        alt={agency.name}
                        className="w-10 h-10 rounded-lg object-cover"
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
                        const { data: session } = await supabase.auth.getSession();
                        const { data, error } = await supabase.functions.invoke('authenticate-with-context', {
                          headers: {
                            Authorization: `Bearer ${session.session?.access_token}`,
                          },
                          body: {
                            contextType: 'agency',
                            agencyId: agency.id,
                            isPreview: true,
                          },
                        });
                        
                        if (error) throw error;
                        
                        window.open(`/agency?token=${data.token}`, '_blank');
                      } catch (error) {
                        toast.error('Failed to enter preview mode');
                        console.error(error);
                      }
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
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
