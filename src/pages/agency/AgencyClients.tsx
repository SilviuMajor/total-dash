import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Eye, Trash2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AgencyClients() {
  const { profile, isPreviewMode, previewAgency } = useMultiTenantAuth();
  const agencyId = isPreviewMode ? previewAgency?.id : profile?.agency?.id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [canAddMore, setCanAddMore] = useState(true);
  const [limits, setLimits] = useState<any>(null);

  useEffect(() => {
    loadClients();
    checkLimits();
  }, [profile]);

  const checkLimits = async () => {
    if (!agencyId) return;

    const { data, error } = await supabase.rpc('check_agency_limit', {
      _agency_id: agencyId,
      _limit_type: 'clients'
    });

    setCanAddMore(data === true);

    // Load subscription for display
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

  const loadClients = async () => {
    if (!agencyId) return;

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('agency_id', agencyId)
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
      // Generate slug from client name
      const slug = clientName.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim();
      
      const { error} = await supabase
        .from('clients')
        .insert([{
          name: clientName,
          slug: slug,
          agency_id: agencyId,
          contact_email: formData.get('email') as string,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client created successfully",
      });
      setOpen(false);
      loadClients();
      checkLimits();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          deleted_at: new Date().toISOString(),
          scheduled_deletion_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client scheduled for deletion in 90 days",
      });
      loadClients();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const maxClients = limits?.is_custom_limits ? limits.custom_max_clients : limits?.subscription_plans?.max_clients;
  const currentClients = limits?.current_clients || 0;
  const isOverLimit = maxClients !== -1 && currentClients > maxClients;

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
            <Button
              variant="outline"
              className="ml-auto"
              onClick={() => navigate('/agency/subscription')}
            >
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
              <p className="text-sm text-muted-foreground">
                Upgrade your subscription to add more clients
              </p>
            </div>
            <Button
              variant="outline"
              className="ml-auto"
              onClick={() => navigate('/agency/subscription')}
            >
              Upgrade
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <Card key={client.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{client.name}</CardTitle>
                  {(() => {
                    const status = client.status?.toLowerCase() || 'active';
                    switch (status) {
                      case 'active':
                        return <Badge className="mt-2 bg-green-600 hover:bg-green-700">Active</Badge>;
                      case 'inactive':
                        return <Badge className="mt-2 bg-gray-500 hover:bg-gray-600">Inactive</Badge>;
                      case 'pending':
                        return <Badge className="mt-2 border-yellow-500 text-yellow-600" variant="outline">Pending</Badge>;
                      case 'suspended':
                        return <Badge className="mt-2" variant="destructive">Suspended</Badge>;
                      default:
                        return <Badge className="mt-2" variant="outline">{client.status}</Badge>;
                    }
                  })()}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{client.contact_email}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => navigate(`/agency/clients/${client.id}`)}
                >
                  View Details
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const targetAgencyId = agencyId || profile?.agency?.id;
                    window.open(`/?preview=true&clientId=${client.id}&agencyId=${targetAgencyId}`, '_blank');
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Dashboard
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(client.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
