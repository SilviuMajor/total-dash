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
}

export default function AdminClients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('clients')
        .insert([{ name: newClientName }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client created successfully",
      });

      setNewClientName("");
      setOpen(false);
      loadClients();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Client Management</h1>
          <p className="text-muted-foreground">Manage your client accounts and assignments.</p>
        </div>
        
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
                <Input
                  id="clientName"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Enter client name"
                  required
                  className="bg-muted/50 border-border"
                />
              </div>
              <Button type="submit" className="w-full bg-foreground text-background hover:bg-foreground/90">
                Create Client
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-6 bg-gradient-card border-border/50 animate-pulse">
              <div className="h-24"></div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id} className="p-6 bg-gradient-card border-border/50 hover:border-primary/50 transition-all group">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{client.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(client.created_at).toLocaleDateString()}
                  </p>
                  <Badge variant="outline" className="mt-2">
                    {client.subscription_status || "Basic"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-border/50 gap-2"
                  onClick={() => navigate(`/admin/clients/${client.id}/overview`)}
                >
                  <Settings className="w-4 h-4" />
                  Manage Client
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-border/50 gap-2"
                  onClick={() => window.open(`/client/${client.id}/dashboard`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                  View Dashboard
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
