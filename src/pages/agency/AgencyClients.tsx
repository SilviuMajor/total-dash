import { useState, useMemo } from "react";
import { TableSkeleton } from "@/components/skeletons";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useToast } from "@/hooks/use-toast";
import { Plus, Eye, Settings, AlertCircle, Building2, Bot, Users, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAgencyClients, useClientAgents, useClientUserCounts } from "@/hooks/queries/useAgencyClients";

export default function AgencyClients() {
  const { profile, isPreviewMode, previewAgency } = useMultiTenantAuth();
  const { startImpersonation, isImpersonating, activeSession } = useImpersonation();
  const agencyId = isPreviewMode 
    ? (previewAgency?.id || activeSession?.agency_id) 
    : profile?.agency?.id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [canAddMore, setCanAddMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
  const isOverLimit = maxClients !== -1 && currentClients > (maxClients ?? Infinity);

  // Summary metrics
  const totalAgents = Object.values(clientAgents as Record<string, any[]>).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  const totalUsers = Object.values(clientUsers as Record<string, number>).reduce((sum, n) => sum + (n || 0), 0);

  // Filtered clients
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter((c: any) => c.name.toLowerCase().includes(q));
  }, [clients, searchQuery]);

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground">Manage your client accounts</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="default" disabled={!canAddMore || currentClients >= (maxClients ?? Infinity)}>
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

      {/* Limit warnings */}
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

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-card border rounded-lg flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Clients</p>
            <p className="text-lg font-semibold leading-tight">
              {currentClients}
              {maxClients !== undefined && maxClients !== null && (
                <span className="text-sm font-normal text-muted-foreground"> / {maxClients === -1 ? '∞' : maxClients}</span>
              )}
            </p>
          </div>
        </div>
        <div className="p-4 bg-card border rounded-lg flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Agents</p>
            <p className="text-lg font-semibold leading-tight">{totalAgents}</p>
          </div>
        </div>
        <div className="p-4 bg-card border rounded-lg flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Users</p>
            <p className="text-lg font-semibold leading-tight">{totalUsers}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr_auto] items-center px-4 py-2.5 bg-muted/50 border-b border-border">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agents</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Users</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
          <span className="w-36" />
        </div>

        {filteredClients.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground font-medium">
              {searchQuery ? 'No clients match your search' : 'No clients yet'}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {searchQuery ? 'Try a different search term.' : 'Create your first client to get started.'}
            </p>
          </div>
        ) : filteredClients.map((client: any) => {
          const initials = client.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
          const status = client.status?.toLowerCase() || 'active';
          return (
            <div
              key={client.id}
              className="grid grid-cols-[2.5fr_1fr_1fr_1fr_auto] items-center px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors last:border-0"
            >
              {/* Client */}
              <div className="flex items-center gap-3 min-w-0">
                {client.logo_url ? (
                  <img src={client.logo_url} alt={client.name} className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-primary">{initials}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{client.name}</p>
                  {client.contact_email && (
                    <p className="text-xs text-muted-foreground truncate">{client.contact_email}</p>
                  )}
                </div>
              </div>

              {/* Agents */}
              <span className="text-sm font-medium">{(clientAgents as any)[client.id]?.length || 0}</span>

              {/* Users */}
              <span className="text-sm font-medium">{(clientUsers as any)[client.id] || 0}</span>

              {/* Status */}
              <div>
                {status === 'active' && (
                  <span className="text-xs bg-green-50 text-green-600 px-2.5 py-0.5 rounded-md font-medium">Active</span>
                )}
                {status === 'inactive' && (
                  <span className="text-xs bg-muted text-muted-foreground px-2.5 py-0.5 rounded-md font-medium">Inactive</span>
                )}
                {status === 'pending' && (
                  <span className="text-xs bg-yellow-50 text-yellow-600 px-2.5 py-0.5 rounded-md font-medium">Pending</span>
                )}
                {status === 'suspended' && (
                  <span className="text-xs bg-red-50 text-red-600 px-2.5 py-0.5 rounded-md font-medium">Suspended</span>
                )}
                {!['active', 'inactive', 'pending', 'suspended'].includes(status) && (
                  <span className="text-xs bg-muted text-muted-foreground px-2.5 py-0.5 rounded-md font-medium">{client.status}</span>
                )}
              </div>

              {/* Actions */}
              <div className="w-36 flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={async () => {
                    try {
                      await startImpersonation({
                        targetType: 'client_full',
                        clientId: client.id,
                        agencyId: agencyId || profile?.agency?.id || undefined,
                        parentSessionId: activeSession?.id || undefined,
                      });
                      window.location.href = '/';
                    } catch (e: any) {
                      toast({ title: "Error", description: e.message, variant: "destructive" });
                    }
                  }}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Preview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => navigate(`/agency/clients/${client.id}`)}
                >
                  <Settings className="h-3.5 w-3.5 mr-1" />
                  Manage
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
