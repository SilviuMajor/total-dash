import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, Save, Link2, Plus, Minus } from "lucide-react";

export default function AgencyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agency, setAgency] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [stripeSubId, setStripeSubId] = useState("");
  const [linkingStripe, setLinkingStripe] = useState(false);
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [customMaxClients, setCustomMaxClients] = useState<number>(1);
  const [customMaxAgents, setCustomMaxAgents] = useState<number>(1);
  const [customMaxTeam, setCustomMaxTeam] = useState<number>(1);
  const [savingSubscription, setSavingSubscription] = useState(false);

  useEffect(() => {
    loadAgencyDetails();
    loadSubscriptionPlans();
  }, [id]);

  const loadAgencyDetails = async () => {
    try {
      const { data: agencyData, error: agencyError } = await supabase
        .from('agencies')
        .select('*')
        .eq('id', id)
        .single();

      if (agencyError) throw agencyError;
      setAgency(agencyData);

      const { data: subData } = await supabase
        .from('agency_subscriptions')
        .select(`
          *,
          subscription_plans:plan_id (*)
        `)
        .eq('agency_id', id)
        .single();

      setSubscription(subData);
      
      // Initialize custom values
      if (subData) {
        setCustomPrice((subData.custom_price_monthly_cents || subData.subscription_plans?.price_monthly_cents || 0) / 100);
        setCustomMaxClients(subData.custom_max_clients || subData.subscription_plans?.max_clients || 1);
        setCustomMaxAgents(subData.custom_max_agents || subData.subscription_plans?.max_agents || 1);
        setCustomMaxTeam(subData.custom_max_team_members || subData.subscription_plans?.max_team_members || 1);
      }
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

  const loadSubscriptionPlans = async () => {
    const { data } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly_cents');
    
    setPlans(data || []);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('agencies')
        .update({
          name: agency.name,
          slug: agency.slug,
          primary_color: agency.primary_color,
          secondary_color: agency.secondary_color,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Agency details updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSubscription = async () => {
    setSavingSubscription(true);
    try {
      const basePlan = subscription?.subscription_plans;
      const priceInCents = Math.round(customPrice * 100);
      
      const isCustomPricing = priceInCents !== basePlan?.price_monthly_cents;
      const isCustomLimits = (
        customMaxClients !== basePlan?.max_clients ||
        customMaxAgents !== basePlan?.max_agents ||
        customMaxTeam !== basePlan?.max_team_members
      );

      const { error } = await supabase
        .from('agency_subscriptions')
        .update({
          custom_price_monthly_cents: priceInCents,
          custom_max_clients: customMaxClients,
          custom_max_agents: customMaxAgents,
          custom_max_team_members: customMaxTeam,
          is_custom_pricing: isCustomPricing,
          is_custom_limits: isCustomLimits,
        })
        .eq('agency_id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subscription updated successfully",
      });
      loadAgencyDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingSubscription(false);
    }
  };

  const isCustomPlan = () => {
    const basePlan = subscription?.subscription_plans;
    if (!basePlan) return false;
    
    const priceInCents = Math.round(customPrice * 100);
    return (
      priceInCents !== basePlan.price_monthly_cents ||
      customMaxClients !== basePlan.max_clients ||
      customMaxAgents !== basePlan.max_agents ||
      customMaxTeam !== basePlan.max_team_members
    );
  };

  // Helper to extract HTTP status from Supabase function errors
  const getHttpStatus = (err: any): number | null => {
    // Direct status property
    if (typeof err?.status === 'number') return err.status;
    
    // Nested in context
    if (typeof err?.context?.status === 'number') return err.context.status;
    
    // In FunctionsHttpError or FunctionsRelayError
    if (err?.context?.body) {
      try {
        const parsed = typeof err.context.body === 'string' 
          ? JSON.parse(err.context.body) 
          : err.context.body;
        if (typeof parsed?.status === 'number') return parsed.status;
      } catch {}
    }
    
    return null;
  };

  const invokePreview = async (isRetry = false) => {
    try {
      const { data, error } = await supabase.functions.invoke('authenticate-with-context', {
        body: {
          contextType: 'agency',
          agencyId: id,
          isPreview: true,
        },
      });

      if (error) {
        const status = getHttpStatus(error);
        
        // On 401 and not retrying: refresh session and retry once
        if (status === 401 && !isRetry) {
          console.log('Preview auth failed with 401, refreshing session and retrying...');
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('Session refresh failed:', refreshError);
            toast({
              title: "Session expired",
              description: "Please log in again.",
              variant: "destructive",
            });
            return;
          }
          // Retry once
          return invokePreview(true);
        }
        
        // Handle 403 specifically
        if (status === 403) {
          toast({
            title: "Permission denied",
            description: "You do not have permission to preview this agency.",
            variant: "destructive",
          });
          return;
        }
        
        // Other errors
        throw error;
      }

      if (!data?.token) {
        toast({
          title: "Error",
          description: "No preview token received.",
          variant: "destructive",
        });
        return;
      }

      window.open(`/agency?token=${data.token}`, '_blank');
    } catch (error: any) {
      console.error('Error generating preview token:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate preview token",
        variant: "destructive",
      });
    }
  };

  const handlePreview = () => {
    invokePreview();
  };

  const handleToggleManualOverride = async (enabled: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('agency_subscriptions')
        .update({ 
          manual_override: enabled,
          override_by: enabled ? user?.id : null,
          override_reason: enabled ? subscription?.override_reason : null
        })
        .eq('agency_id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Manual override ${enabled ? 'enabled' : 'disabled'}`,
      });
      loadAgencyDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveOverrideReason = async () => {
    try {
      const { error } = await supabase
        .from('agency_subscriptions')
        .update({ override_reason: subscription?.override_reason })
        .eq('agency_id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Override reason saved",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLinkStripeSubscription = async () => {
    if (!stripeSubId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Stripe subscription ID",
        variant: "destructive",
      });
      return;
    }

    setLinkingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke('link-stripe-subscription', {
        body: { 
          agency_id: id,
          stripe_subscription_id: stripeSubId.trim()
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Stripe subscription linked successfully",
      });
      
      setStripeSubId("");
      loadAgencyDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to link Stripe subscription",
        variant: "destructive",
      });
    } finally {
      setLinkingStripe(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/agencies')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold">{agency?.name}</h1>
            <p className="text-muted-foreground">Manage agency details and subscription</p>
          </div>
        </div>
        <Button onClick={handlePreview} variant="outline">
          <Eye className="mr-2 h-4 w-4" />
          Preview Agency
        </Button>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Agency Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Agency Name</Label>
              <Input
                value={agency?.name || ''}
                onChange={(e) => setAgency({ ...agency, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={agency?.slug || ''}
                onChange={(e) => setAgency({ ...agency, slug: e.target.value })}
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Current Plan</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {subscription?.subscription_plans ? (
                  <>
                    <Badge variant={isCustomPlan() ? "outline" : "default"} className={isCustomPlan() ? "border-purple-500 text-purple-600" : ""}>
                      {isCustomPlan() ? "Custom Plan" : subscription.subscription_plans.name}
                    </Badge>
                    {!isCustomPlan() && (
                      <span className="text-xs text-muted-foreground">
                        (Base: {subscription.subscription_plans.name})
                      </span>
                    )}
                  </>
                ) : (
                  <Badge variant="secondary">None</Badge>
                )}
                <Badge variant={
                  subscription?.status === 'active' ? 'default' :
                  subscription?.status === 'trialing' ? 'secondary' :
                  'destructive'
                }>
                  {subscription?.status || 'None'}
                </Badge>
                {subscription?.manual_override && (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                    Manual Override Active
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <div className="space-y-2">
                <Label>Monthly Price</Label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
                    className="max-w-[150px] text-lg"
                  />
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Subscription Limits</Label>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Max Clients:</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCustomMaxClients(Math.max(1, customMaxClients - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      value={customMaxClients}
                      onChange={(e) => setCustomMaxClients(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCustomMaxClients(customMaxClients + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Max Agents:</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCustomMaxAgents(Math.max(1, customMaxAgents - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      value={customMaxAgents}
                      onChange={(e) => setCustomMaxAgents(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCustomMaxAgents(customMaxAgents + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Max Team:</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCustomMaxTeam(Math.max(1, customMaxTeam - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      value={customMaxTeam}
                      onChange={(e) => setCustomMaxTeam(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCustomMaxTeam(customMaxTeam + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleSaveSubscription} 
                disabled={savingSubscription}
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                {savingSubscription ? 'Saving...' : 'Save Subscription Changes'}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Current Usage</Label>
              <div className="text-sm space-y-1 p-3 bg-muted/30 rounded-md">
                <div className="flex justify-between">
                  <span>Clients:</span>
                  <span className="font-medium">{subscription?.current_clients} / {customMaxClients}</span>
                </div>
                <div className="flex justify-between">
                  <span>Agents:</span>
                  <span className="font-medium">{subscription?.current_agents} / {customMaxAgents}</span>
                </div>
                <div className="flex justify-between">
                  <span>Team:</span>
                  <span className="font-medium">{subscription?.current_team_members} / {customMaxTeam}</span>
                </div>
              </div>
            </div>

            {subscription?.trial_ends_at && (
              <div className="text-sm text-muted-foreground">
                Trial ends: {new Date(subscription.trial_ends_at).toLocaleDateString()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stripe Integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscription?.stripe_subscription_id ? (
              <div className="space-y-2">
                <Label>Stripe Subscription ID</Label>
                <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-muted/50">
                  <Link2 className="w-4 h-4 text-success" />
                  <code className="text-sm">{subscription.stripe_subscription_id}</code>
                  <Badge variant="outline" className="ml-auto border-success text-success">
                    Linked
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  This subscription is linked to Stripe and will sync automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Link Stripe Subscription</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="sub_xxxxxxxxxxxxx"
                    value={stripeSubId}
                    onChange={(e) => setStripeSubId(e.target.value)}
                  />
                  <Button 
                    onClick={handleLinkStripeSubscription}
                    disabled={linkingStripe || !stripeSubId.trim()}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    {linkingStripe ? 'Linking...' : 'Link'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter a Stripe subscription ID to link it to this agency. This will import subscription details from Stripe.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manual Access Control</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Manual Override</Label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="manual-override"
                  checked={subscription?.manual_override || false}
                  onChange={(e) => handleToggleManualOverride(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="manual-override" className="font-normal cursor-pointer">
                  Allow access regardless of subscription status
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Enable this to grant access even if payment has failed or subscription is canceled.
              </p>
            </div>
            {subscription?.manual_override && (
              <div className="space-y-2">
                <Label>Override Reason</Label>
                <textarea
                  value={subscription?.override_reason || ''}
                  onChange={(e) => setSubscription({ ...subscription, override_reason: e.target.value })}
                  className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                  placeholder="Document why this override was granted (e.g., special arrangement, testing, etc.)"
                />
                <Button 
                  onClick={handleSaveOverrideReason}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  Save Reason
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
