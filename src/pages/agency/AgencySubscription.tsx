import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useToast } from "@/hooks/use-toast";
import { Check, Crown } from "lucide-react";

export default function AgencySubscription() {
  const { profile, isPreviewMode, previewAgency } = useMultiTenantAuth();
  const agencyId = isPreviewMode ? previewAgency?.id : profile?.agency?.id;
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscription();
    loadPlans();

    // Check for success/canceled query params
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      toast({
        title: "Success!",
        description: "Your subscription has been activated.",
      });
      // Clear the query params
      window.history.replaceState({}, '', window.location.pathname);
      // Reload subscription data
      setTimeout(() => loadSubscription(), 2000);
    } else if (params.get('canceled') === 'true') {
      toast({
        title: "Checkout Canceled",
        description: "You can subscribe anytime.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [profile]);

  const loadSubscription = async () => {
    if (!agencyId) return;

    try {
      const { data, error } = await supabase
        .from('agency_subscriptions')
        .select(`
          *,
          subscription_plans:plan_id (*)
        `)
        .eq('agency_id', agencyId)
        .single();

      if (error) throw error;
      setSubscription(data);
    } catch (error: any) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    const { data } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly_cents');

    setPlans(data || []);
  };

  const handleSelectPlan = async (planId: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('create-agency-checkout', {
        body: { planId }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription plan</p>
      </div>

      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">{subscription.subscription_plans?.name}</h3>
                <p className="text-muted-foreground">
                  ${subscription.subscription_plans?.price_monthly_cents / 100}/month
                </p>
              </div>
              <Badge variant={
                subscription.status === 'active' ? 'default' :
                subscription.status === 'trialing' ? 'secondary' :
                'destructive'
              }>
                {subscription.status}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Clients</p>
                <p className="text-2xl font-bold">
                  {subscription.current_clients} / {subscription.subscription_plans?.max_clients === -1 ? '∞' : subscription.subscription_plans?.max_clients}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Agents</p>
                <p className="text-2xl font-bold">
                  {subscription.current_agents} / {subscription.subscription_plans?.max_agents === -1 ? '∞' : subscription.subscription_plans?.max_agents}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Team</p>
                <p className="text-2xl font-bold">
                  {subscription.current_team_members} / {subscription.subscription_plans?.max_team_members === -1 ? '∞' : subscription.subscription_plans?.max_team_members}
                </p>
              </div>
            </div>

            {subscription.trial_ends_at && subscription.status === 'trialing' && (
              <div className="text-sm text-muted-foreground bg-blue-500/10 p-3 rounded-lg">
                Trial ends on {new Date(subscription.trial_ends_at).toLocaleDateString()}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = subscription?.plan_id === plan.id;
            return (
              <Card key={plan.id} className={isCurrent ? 'border-primary' : ''}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>{plan.name}</CardTitle>
                    {isCurrent && (
                      <Badge variant="default">Current</Badge>
                    )}
                  </div>
                  <div className="text-3xl font-bold">
                    ${plan.price_monthly_cents / 100}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {plan.max_clients === -1 ? 'Unlimited' : plan.max_clients} clients
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {plan.max_agents === -1 ? 'Unlimited' : plan.max_agents} agents
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {plan.max_team_members === -1 ? 'Unlimited' : plan.max_team_members} team members
                    </li>
                    {plan.has_whitelabel_access && (
                      <li className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-primary" />
                        Whitelabel access
                      </li>
                    )}
                    {plan.has_support_access && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        Priority support
                      </li>
                    )}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isCurrent ? 'outline' : 'default'}
                    disabled={isCurrent}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {isCurrent ? 'Current Plan' : 'Select Plan'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
