import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Calendar, ArrowRight } from "lucide-react";
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
      console.log("Loading agencies..."); // Debug logging
      
      const { data, error } = await supabase
        .from('agencies')
        .select(`
          *,
          subscription:agency_subscriptions (
            status,
            current_clients,
            current_agents,
            plan:subscription_plans (
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      console.log("Agencies query result:", { data, error }); // Debug logging

      if (error) {
        console.error("Query error:", error); // Debug logging
        throw error;
      }
      
      console.log(`Loaded ${data?.length || 0} agencies`); // Debug logging
      setAgencies(data || []);
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
    
    const subscription = agency.subscription?.[0];
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

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {agencies.map((agency) => {
          const subscription = agency.subscription?.[0];
          
          return (
            <Card key={agency.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between mb-3">
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
                  {getStatusBadge(agency)}
                </div>
                <CardTitle className="text-lg">{agency.name}</CardTitle>
                <CardDescription className="text-xs">@{agency.slug}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-medium">{subscription?.plan?.name || 'No Plan'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Clients</span>
                    <span className="font-medium">{subscription?.current_clients || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Agents</span>
                    <span className="font-medium">{subscription?.current_agents || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium text-xs">
                      {new Date(agency.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/admin/agencies/${agency.id}`)}
                >
                  Manage Agency
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
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
