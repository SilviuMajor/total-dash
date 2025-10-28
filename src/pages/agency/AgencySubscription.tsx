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

  const handleCancelTrial = async () => {
    if (!confirm('Cancel your trial? You will lose access immediately and will not be charged.')) {
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('cancel-trial-subscription');
      
      if (error) throw error;
      
      toast({
        title: "Trial Canceled",
        description: "Your trial has been canceled successfully.",
      });
      loadSubscription();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel trial",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCustomerPortal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to open customer portal",
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
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold">{subscription.subscription_plans?.name}</h3>
                  {(subscription.is_custom_pricing || subscription.is_custom_limits) && (
                    <Badge variant="outline" className="text-xs">Custom Plan</Badge>
                  )}
                </div>
                <p className="text-muted-foreground">
                  ${(subscription.is_custom_pricing ? subscription.custom_price_monthly_cents : subscription.subscription_plans?.price_monthly_cents) / 100}/month
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
                  {subscription.current_clients} / {
                    (() => {
                      const limit = subscription.is_custom_limits 
                        ? subscription.custom_max_clients 
                        : subscription.subscription_plans?.max_clients;
                      return limit === -1 ? '∞' : limit;
                    })()
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Agents</p>
                <p className="text-2xl font-bold">
                  {subscription.current_agents} / {
                    (() => {
                      const limit = subscription.is_custom_limits 
                        ? subscription.custom_max_agents 
                        : subscription.subscription_plans?.max_agents;
                      return limit === -1 ? '∞' : limit;
                    })()
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Team</p>
                <p className="text-2xl font-bold">
                  {subscription.current_team_members} / {
                    (() => {
                      const limit = subscription.is_custom_limits 
                        ? subscription.custom_max_team_members 
                        : subscription.subscription_plans?.max_team_members;
                      return limit === -1 ? '∞' : limit;
                    })()
                  }
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

      {subscription?.status === 'trialing' && subscription?.trial_ends_at && (
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardHeader>
            <CardTitle>Your Trial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-2">
              <p>
                Trial ends on <strong>{new Date(subscription.trial_ends_at).toLocaleDateString()}</strong>
              </p>
              <p>
                After your trial, you'll be automatically subscribed to the{' '}
                <strong>{subscription.snapshot_plan_name || subscription.subscription_plans?.name}</strong> plan at{' '}
                <strong>${(subscription.snapshot_price_monthly_cents || subscription.subscription_plans?.price_monthly_cents) / 100}/month</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                You can cancel anytime during the trial to avoid charges.
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleCancelTrial}
                className="flex-1"
              >
                Cancel Trial
              </Button>
              
              {subscription.stripe_customer_id && (
                <Button 
                  variant="ghost" 
                  onClick={handleOpenCustomerPortal}
                  className="flex-1"
                >
                  Manage Payment
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {subscription?.status === 'active' && subscription?.stripe_customer_id && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Manage your subscription, update payment methods, view invoices, and more through Stripe.
            </p>
            <Button onClick={handleOpenCustomerPortal} variant="outline">
              Open Stripe Portal
            </Button>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {plans
            .filter((plan) => {
              const isCustomPlan = subscription?.is_custom_pricing || subscription?.is_custom_limits;
              const currentPrice = subscription?.is_custom_pricing 
                ? subscription.custom_price_monthly_cents 
                : subscription?.subscription_plans?.price_monthly_cents || 0;
              
              // If on custom plan, show all plans. Otherwise only show upgrades
              return isCustomPlan || plan.price_monthly_cents > currentPrice;
            })
            .map((plan) => {
            const isCustomPlan = subscription?.is_custom_pricing || subscription?.is_custom_limits;
            const isCurrent = subscription?.plan_id === plan.id && !isCustomPlan;
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
