import { useState } from "react";
import { TableSkeleton } from "@/components/skeletons";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Eye, Settings, AlertCircle, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAgencyClients, useClientAgents, useClientUserCounts } from "@/hooks/queries/useAgencyClients";

export default function AgencyClients() {
  const { profile, isPreviewMode, previewAgency } = useMultiTenantAuth();
  const agencyId = isPreviewMode ? previewAgency?.id : profile?.agency?.id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [canAddMore, setCanAddMore] = useState(true);

  interface SubscriptionLimits {
    current_clients: number | null;
    custom_max_clients: number | null;
    is_custom_limits: boolean | null;
    subscription_plans: { max_clients: number } | null;
  }

  const [limits, setLimits] = useState<SubscriptionLimits | null>(null);

  const { data: clients = [], isLoading } = useAgencyClients(agencyId);
  const clientIds = clients.map(c => c.id);
  const { data: clientAgents = {} } = useClientAgents(agencyId, clientIds);
  const { data: clientUsers = {} } = useClientUserCounts(clientIds);

  useEffect(() => {
    checkLimits();
  }, [agencyId]);

  const checkLimits = async () => {
    if (!agencyId) return;

    const { data } = await supabase.rpc('check_agency_limit', {
      _agency_id: agencyId,
      _limit_type: 'clients'
    });

    setCanAddMore(data === true);

    const { data: subData } = await supabase
      .from('agency_subscriptions')
      .select(`
        current_clients,
        custom_max_clients,
        is_custom_limits,
        subscription_plans:plan_id (max_clients)
      `)
      .eq('agency_id', agencyId)
      .single();

    setLimits(subData);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canAddMore) {
      toast({
        title: "Limit Reached",
        description: "Please upgrade your subscription to add more clients",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData(e.currentTarget);
    try {
      const clientName = formData.get('name') as string;
      const slug = clientName.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim();

      const { error } = await supabase
        .from('clients')
        .insert([{
          name: clientName,
          slug,
          agency_id: agencyId,
          contact_email: formData.get('email') as string,
        }]);

      if (error) throw error;

      toast({ title: "Success", description: "Client created successfully" });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['agency-clients', agencyId] });
      checkLimits();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const maxClients = limits?.is_custom_limits ? limits.custom_max_clients : limits?.subscription_plans?.max_clients;
  const currentClients = limits?.current_clients || 0;
  const isOverLimit = maxClients !== -1 && currentClients > maxClients;

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">Clients</h1>
          <p className="text-muted-foreground">
            Manage your client accounts
            {limits && (
              <span className={`ml-2 ${isOverLimit ? 'text-red-500 font-semibold' : ''}`}>
                ({currentClients} / {maxClients === -1 ? '∞' : maxClients})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!canAddMore || currentClients >= maxClients}>
                <Plus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Client</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Client Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Contact Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <Button type="submit" className="w-full">Create Client</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isOverLimit && (
        <Card className="border-red-500 bg-red-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="font-semibold text-red-500">Over Subscription Limit</p>
              <p className="text-sm text-muted-foreground">
                You currently have {currentClients} clients but your plan allows {maxClients}.
                You cannot add new clients until you delete some or upgrade your plan.
              </p>
            </div>
            <Button variant="outline" className="ml-auto" onClick={() => navigate('/agency/subscription')}>
              Upgrade
            </Button>
          </CardContent>
        </Card>
      )}

      {!canAddMore && !isOverLimit && (
        <Card className="border-yellow-500 bg-yellow-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="font-semibold">Client Limit Reached</p>
              <p className="text-sm text-muted-foreground">Upgrade your subscription to add more clients</p>
            </div>
            <Button variant="outline" className="ml-auto" onClick={() => navigate('/agency/subscription')}>
              Upgrade
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {clients.map((client: any) => (
          <Card key={client.id} className="w-full">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {client.logo_url ? (
                    <img src={client.logo_url} alt={client.name} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <h3 className="text-lg font-semibold">{client.name}</h3>
                  {(() => {
                    const status = client.status?.toLowerCase() || 'active';
                    switch (status) {
                      case 'active': return <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>;
                      case 'inactive': return <Badge className="bg-gray-500 hover:bg-gray-600">Inactive</Badge>;
                      case 'pending': return <Badge className="border-yellow-500 text-yellow-600" variant="outline">Pending</Badge>;
                      case 'suspended': return <Badge variant="destructive">Suspended</Badge>;
                      default: return <Badge variant="outline">{client.status}</Badge>;
                    }
                  })()}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const targetAgencyId = agencyId || profile?.agency?.id;
                    window.open(`/?preview=true&clientId=${client.id}&agencyId=${targetAgencyId}`, '_blank');
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
              </div>

              <div className="flex items-center justify-between pl-[52px]">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div>
                    Agents: <span className="font-medium text-foreground">
                      {(clientAgents as any)[client.id]?.length || 0}
                    </span>
                  </div>
                  <div>
                    Users: <span className="font-medium text-foreground">
                      {(clientUsers as any)[client.id] || 0}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="default" onClick={() => navigate(`/agency/clients/${client.id}`)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
