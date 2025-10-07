import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Settings, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
  subscription_status: string | null;
  status: string | null;
}
export default function AdminClients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [agencyLogoUrl, setAgencyLogoUrl] = useState<string | null>(null);
  const {
    toast
  } = useToast();
  useEffect(() => {
    loadClients();
    loadAgencyLogo();
  }, []);
  const loadAgencyLogo = async () => {
    const {
      data
    } = await supabase.from('agency_settings').select('agency_logo_url').single();
    if (data?.agency_logo_url) {
      setAgencyLogoUrl(data.agency_logo_url);
    }
  };
  const loadClients = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };
  const filteredClients = clients.filter(client => client.status === statusFilter);
  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'testing':
        return 'secondary';
      case 'inactive':
        return 'outline';
      default:
        return 'default';
    }
  };
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const {
        error
      } = await supabase.from('clients').insert([{
        name: newClientName
      }]);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Client created successfully"
      });
      setNewClientName("");
      setOpen(false);
      loadClients();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  return <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Client Management</h1>
          <p className="text-muted-foreground">Manage your client accounts and assignments.</p>
        </div>
        {agencyLogoUrl}
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-foreground text-background hover:bg-foreground/90 gap-2">
              <Plus className="w-4 h-4" />
              New Client
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Create New Client</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input id="clientName" value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Enter client name" required className="bg-muted/50 border-border" />
              </div>
              <Button type="submit" className="w-full bg-foreground text-background hover:bg-foreground/90">
                Create Client
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 mb-6">
        <Button variant={statusFilter === 'active' ? 'default' : 'outline'} onClick={() => setStatusFilter('active')} className={statusFilter === 'active' ? 'bg-foreground text-background' : ''}>
          Active ({clients.filter(c => c.status === 'active').length})
        </Button>
        <Button variant={statusFilter === 'testing' ? 'default' : 'outline'} onClick={() => setStatusFilter('testing')} className={statusFilter === 'testing' ? 'bg-foreground text-background' : ''}>
          Testing ({clients.filter(c => c.status === 'testing').length})
        </Button>
        <Button variant={statusFilter === 'inactive' ? 'default' : 'outline'} onClick={() => setStatusFilter('inactive')} className={statusFilter === 'inactive' ? 'bg-foreground text-background' : ''}>
          Inactive ({clients.filter(c => c.status === 'inactive').length})
        </Button>
        <Button variant={statusFilter === 'deleting' ? 'default' : 'outline'} onClick={() => setStatusFilter('deleting')} className={statusFilter === 'deleting' ? 'bg-foreground text-background' : ''}>
          Deleting ({clients.filter(c => c.status === 'deleting').length})
        </Button>
      </div>

      {loading ? <div className="space-y-4 w-full">
          {[...Array(6)].map((_, i) => <Card key={i} className="p-6 bg-gradient-card border-border/50 animate-pulse">
              <div className="h-24"></div>
            </Card>)}
        </div> : filteredClients.length === 0 ? <Card className="p-12 text-center bg-gradient-card border-border/50">
          <p className="text-muted-foreground">No {statusFilter} clients found</p>
        </Card> : <div className="space-y-4 w-full">
          {filteredClients.map(client => <Card key={client.id} className="w-full p-6 bg-gradient-card border-border/50 hover:border-primary/50 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-6">
                {/* Client Logo */}
                <div className="flex-shrink-0">
                  {client.logo_url ? <img src={client.logo_url} alt={client.name} className="w-16 h-16 object-cover rounded-lg" /> : <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Users className="w-8 h-8 text-primary" />
                    </div>}
                </div>

                {/* Client Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-foreground truncate">{client.name}</h3>
                    <Badge variant={getStatusBadgeVariant(client.status)} className="capitalize">
                      {client.status || 'active'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(client.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" className="border-border/50 gap-2" onClick={() => navigate(`/admin/clients/${client.id}/overview`)}>
                    <Settings className="w-4 h-4" />
                    Manage Client
                  </Button>
                  <Button variant="outline" className="border-border/50 gap-2" onClick={() => window.open(`/?preview=true&clientId=${client.id}`, '_blank')}>
                    <ExternalLink className="w-4 h-4" />
                    View Dashboard
                  </Button>
                </div>
              </div>
            </Card>)}
        </div>}
    </div>;
}