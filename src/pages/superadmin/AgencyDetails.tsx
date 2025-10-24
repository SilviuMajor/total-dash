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
import { ArrowLeft, Eye, Save } from "lucide-react";

export default function AgencyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agency, setAgency] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);

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
          domain: agency.domain,
          custom_domain: agency.custom_domain,
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

  const handleUpdateSubscription = async (planId: string) => {
    try {
      const { error } = await supabase
        .from('agency_subscriptions')
        .update({ plan_id: planId })
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
    }
  };

  const handlePreview = () => {
    window.open(`/agency?preview=true&agencyId=${id}`, '_blank');
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
            onClick={() => navigate('/super-admin/agencies')}
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
            <div className="space-y-2">
              <Label>Domain</Label>
              <Input
                value={agency?.domain || ''}
                onChange={(e) => setAgency({ ...agency, domain: e.target.value })}
                placeholder="agency-slug.yourplatform.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Custom Domain</Label>
              <Input
                value={agency?.custom_domain || ''}
                onChange={(e) => setAgency({ ...agency, custom_domain: e.target.value })}
                placeholder="dashboard.theirdomain.com"
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
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Current Plan</Label>
              <div className="flex items-center gap-2">
                <Badge>{subscription?.subscription_plans?.name || 'None'}</Badge>
                <Badge variant={
                  subscription?.status === 'active' ? 'default' :
                  subscription?.status === 'trialing' ? 'secondary' :
                  'destructive'
                }>
                  {subscription?.status || 'None'}
                </Badge>
                {subscription?.manual_override && (
                  <Badge variant="outline" className="border-warning text-warning">
                    Manual Override
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Usage</Label>
              <div className="text-sm space-y-1">
                <div>Clients: {subscription?.current_clients} / {subscription?.subscription_plans?.max_clients === -1 ? '∞' : subscription?.subscription_plans?.max_clients}</div>
                <div>Agents: {subscription?.current_agents} / {subscription?.subscription_plans?.max_agents === -1 ? '∞' : subscription?.subscription_plans?.max_agents}</div>
                <div>Team: {subscription?.current_team_members} / {subscription?.subscription_plans?.max_team_members === -1 ? '∞' : subscription?.subscription_plans?.max_team_members}</div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Change Plan</Label>
              <Select
                value={subscription?.plan_id}
                onValueChange={handleUpdateSubscription}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - ${plan.price_monthly_cents / 100}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
