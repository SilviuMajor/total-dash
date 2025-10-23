import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2 } from "lucide-react";

export default function SubscriptionPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price_monthly_cents');

      if (error) throw error;
      setPlans(data || []);
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

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const stripePriceId = formData.get('stripe_price_id') as string;
      
      // Validate Stripe Price ID format if provided
      if (stripePriceId && !stripePriceId.startsWith('price_')) {
        toast({
          title: "Invalid Format",
          description: "Stripe Price ID must start with 'price_'",
          variant: "destructive",
        });
        return;
      }
      
      const planData = {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        tier: formData.get('tier') as any,
        price_monthly_cents: parseInt(formData.get('price_monthly_cents') as string),
        max_clients: parseInt(formData.get('max_clients') as string),
        max_agents: parseInt(formData.get('max_agents') as string),
        max_team_members: parseInt(formData.get('max_team_members') as string),
        has_whitelabel_access: formData.get('has_whitelabel_access') === 'on',
        has_support_access: formData.get('has_support_access') === 'on',
        stripe_price_id: stripePriceId || null,
        is_active: true,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(planData)
          .eq('id', editingPlan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .insert([planData]);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Plan ${editingPlan ? 'updated' : 'created'} successfully`,
      });
      setOpen(false);
      setEditingPlan(null);
      loadPlans();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      toast({
        title: "Success",
        description: "Plan deleted successfully",
      });
      loadPlans();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground">Manage subscription tiers and pricing</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingPlan(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Plan Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingPlan?.name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tier">Tier</Label>
                  <Input
                    id="tier"
                    name="tier"
                    defaultValue={editingPlan?.tier}
                    placeholder="free_trial, starter, pro..."
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  name="description"
                  defaultValue={editingPlan?.description}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price_monthly_cents">Monthly Price (cents)</Label>
                  <Input
                    id="price_monthly_cents"
                    name="price_monthly_cents"
                    type="number"
                    defaultValue={editingPlan?.price_monthly_cents || 0}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stripe_price_id">Stripe Price ID</Label>
                  <Input
                    id="stripe_price_id"
                    name="stripe_price_id"
                    placeholder="price_xxxxxxxxxxxxx"
                    defaultValue={editingPlan?.stripe_price_id || ''}
                  />
                  <p className="text-xs text-muted-foreground">Must start with 'price_'</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_clients">Max Clients</Label>
                  <Input
                    id="max_clients"
                    name="max_clients"
                    type="number"
                    defaultValue={editingPlan?.max_clients || 0}
                    required
                  />
                  <p className="text-xs text-muted-foreground">-1 for unlimited</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_agents">Max Agents</Label>
                  <Input
                    id="max_agents"
                    name="max_agents"
                    type="number"
                    defaultValue={editingPlan?.max_agents || 0}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_team_members">Max Team</Label>
                  <Input
                    id="max_team_members"
                    name="max_team_members"
                    type="number"
                    defaultValue={editingPlan?.max_team_members || 1}
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has_whitelabel_access"
                    name="has_whitelabel_access"
                    defaultChecked={editingPlan?.has_whitelabel_access}
                  />
                  <Label htmlFor="has_whitelabel_access">Whitelabel Access</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has_support_access"
                    name="has_support_access"
                    defaultChecked={editingPlan?.has_support_access}
                  />
                  <Label htmlFor="has_support_access">Support Access</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingPlan ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={!plan.is_active ? 'opacity-50' : ''}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{plan.name}</CardTitle>
                  <Badge className="mt-2">{plan.tier}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingPlan(plan);
                      setOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(plan.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-3xl font-bold">
                ${plan.price_monthly_cents / 100}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </div>
              {plan.description && (
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              )}
              {plan.stripe_price_id ? (
                <div className="text-xs font-mono bg-muted/50 px-2 py-1 rounded">
                  {plan.stripe_price_id}
                </div>
              ) : (
                <div className="text-xs text-yellow-600 dark:text-yellow-500 flex items-center gap-1">
                  ⚠️ Stripe Price ID not configured
                </div>
              )}
              <div className="space-y-1 text-sm">
                <div>• {plan.max_clients === -1 ? 'Unlimited' : plan.max_clients} clients</div>
                <div>• {plan.max_agents === -1 ? 'Unlimited' : plan.max_agents} agents</div>
                <div>• {plan.max_team_members === -1 ? 'Unlimited' : plan.max_team_members} team members</div>
                {plan.has_whitelabel_access && <div>• Whitelabel access</div>}
                {plan.has_support_access && <div>• Priority support</div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
