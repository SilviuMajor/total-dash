import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentTypesSection } from "@/components/agency-management/AgentTypesSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Trash2, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { BrandingUpload } from "@/components/BrandingUpload";

interface KeyStatus {
  exists: boolean;
  maskedValue: string | null;
}

export default function SuperAdminSettings() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [showStripe, setShowStripe] = useState(false);
  const [showStripeWebhook, setShowStripeWebhook] = useState(false);
  const [showStripePublishable, setShowStripePublishable] = useState(false);
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    resend: '',
    stripe: '',
    stripeWebhook: '',
    stripePublishable: ''
  });

  // Platform branding state
  const [branding, setBranding] = useState({
    id: '',
    company_name: 'FiveLeaf',
    logo_light_url: '',
    logo_dark_url: '',
    full_logo_light_url: '',
    full_logo_dark_url: '',
    favicon_light_url: '',
    favicon_dark_url: ''
  });

  const fetchBranding = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_branding')
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setBranding({
          id: data.id,
          company_name: data.company_name || 'FiveLeaf',
          logo_light_url: data.logo_light_url || '',
          logo_dark_url: data.logo_dark_url || '',
          full_logo_light_url: data.full_logo_light_url || '',
          full_logo_dark_url: data.full_logo_dark_url || '',
          favicon_light_url: data.favicon_light_url || '',
          favicon_dark_url: data.favicon_dark_url || ''
        });
      }
    } catch (error) {
      console.error('Error fetching platform branding:', error);
    }
  };

  const saveBranding = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('platform_branding')
        .update({
          company_name: branding.company_name,
          logo_light_url: branding.logo_light_url,
          logo_dark_url: branding.logo_dark_url,
          full_logo_light_url: branding.full_logo_light_url,
          full_logo_dark_url: branding.full_logo_dark_url,
          favicon_light_url: branding.favicon_light_url,
          favicon_dark_url: branding.favicon_dark_url
        })
        .eq('id', branding.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Platform branding updated successfully.",
      });
    } catch (error: any) {
      console.error('Error saving branding:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  const handleSaveOpenAI = async () => {
    if (!apiKeys.openai.trim()) {
      toast({
        title: "Error",
        description: "Please enter an API key",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('save-api-key', {
        body: { 
          keyType: 'openai',
          apiKey: apiKeys.openai.trim()
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "OpenAI API key saved successfully",
      });
      setApiKeys(prev => ({ ...prev, openai: '' }));
      setShowOpenAI(false);
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

  const handleDeleteOpenAI = async () => {
    if (!confirm('Are you sure you want to delete the OpenAI API key?')) return;

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('delete-api-key', {
        body: { keyType: 'openai' }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "OpenAI API key deleted",
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

  const handleSaveResend = async () => {
    if (!apiKeys.resend.trim()) {
      toast({
        title: "Error",
        description: "Please enter an API key",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('save-api-key', {
        body: { 
          keyType: 'resend',
          apiKey: apiKeys.resend.trim()
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Resend API key saved successfully",
      });
      setApiKeys(prev => ({ ...prev, resend: '' }));
      setShowResend(false);
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

  const handleDeleteResend = async () => {
    if (!confirm('Are you sure you want to delete the Resend API key?')) return;

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('delete-api-key', {
        body: { keyType: 'resend' }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Resend API key deleted",
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

  const handleSaveStripe = async () => {
    if (!apiKeys.stripe.trim()) {
      toast({
        title: "Error",
        description: "Please enter an API key",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('save-api-key', {
        body: { 
          keyType: 'stripe',
          apiKey: apiKeys.stripe.trim()
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Stripe Secret Key saved successfully",
      });
      setApiKeys(prev => ({ ...prev, stripe: '' }));
      setShowStripe(false);
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

  const handleDeleteStripe = async () => {
    if (!confirm('Are you sure you want to delete the Stripe Secret Key?')) return;

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('delete-api-key', {
        body: { keyType: 'stripe' }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Stripe Secret Key deleted",
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

  const handleSaveStripeWebhook = async () => {
    if (!apiKeys.stripeWebhook.trim()) {
      toast({
        title: "Error",
        description: "Please enter a webhook secret",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('save-api-key', {
        body: { 
          keyType: 'stripe_webhook',
          apiKey: apiKeys.stripeWebhook.trim()
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Stripe Webhook Secret saved successfully",
      });
      setApiKeys(prev => ({ ...prev, stripeWebhook: '' }));
      setShowStripeWebhook(false);
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

  const handleDeleteStripeWebhook = async () => {
    if (!confirm('Are you sure you want to delete the Stripe Webhook Secret?')) return;

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('delete-api-key', {
        body: { keyType: 'stripe_webhook' }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Stripe Webhook Secret deleted",
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

  const handleSaveStripePublishable = async () => {
    if (!apiKeys.stripePublishable.trim()) {
      toast({
        title: "Error",
        description: "Please enter a publishable key",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('save-api-key', {
        body: { 
          keyType: 'stripe_publishable',
          apiKey: apiKeys.stripePublishable.trim()
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Stripe Publishable Key saved successfully",
      });
      setApiKeys(prev => ({ ...prev, stripePublishable: '' }));
      setShowStripePublishable(false);
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

  const handleDeleteStripePublishable = async () => {
    if (!confirm('Are you sure you want to delete the Stripe Publishable Key?')) return;

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('delete-api-key', {
        body: { keyType: 'stripe_publishable' }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Stripe Publishable Key deleted",
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage super admin settings and configurations
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="agent-types">Agent Types</TabsTrigger>
          <TabsTrigger value="integrations">API Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Super admin general settings will be available here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Branding</CardTitle>
              <CardDescription>
                Customize your platform's branding. This serves as the base branding for all agencies and clients.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={branding.company_name}
                  onChange={(e) => setBranding({ ...branding, company_name: e.target.value })}
                  placeholder="Enter company name"
                />
                <p className="text-xs text-muted-foreground">
                  Used across all dashboards and communications
                </p>
              </div>

              {/* Sidebar Logos Section */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Sidebar Logos</h3>
                  <p className="text-xs text-muted-foreground">
                    Square logos (48-128px) displayed in navigation sidebars
                  </p>
                </div>
                <div className="space-y-4">
                  <BrandingUpload
                    label="Light Mode"
                    description="Appears in sidebars when light theme is active"
                    currentUrl={branding.logo_light_url}
                    onUpload={(url) => setBranding({ ...branding, logo_light_url: url })}
                    bucket="platform-branding"
                    acceptedTypes={['.png', '.jpg', '.jpeg', '.svg']}
                    type="logo"
                  />
                  <BrandingUpload
                    label="Dark Mode"
                    description="Appears in sidebars when dark theme is active"
                    currentUrl={branding.logo_dark_url}
                    onUpload={(url) => setBranding({ ...branding, logo_dark_url: url })}
                    bucket="platform-branding"
                    acceptedTypes={['.png', '.jpg', '.jpeg', '.svg']}
                    type="logo"
                  />
                </div>
              </div>

              {/* Full Logos Section */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Full Logos</h3>
                  <p className="text-xs text-muted-foreground">
                    Wide format logos (400x100px) for login pages and email headers
                  </p>
                </div>
                <div className="space-y-4">
                  <BrandingUpload
                    label="Light Mode"
                    description="Used on login pages and emails in light theme"
                    currentUrl={branding.full_logo_light_url}
                    onUpload={(url) => setBranding({ ...branding, full_logo_light_url: url })}
                    bucket="platform-branding"
                    acceptedTypes={['.png', '.jpg', '.jpeg', '.svg']}
                    type="full-logo"
                  />
                  <BrandingUpload
                    label="Dark Mode"
                    description="Used on login pages and emails in dark theme"
                    currentUrl={branding.full_logo_dark_url}
                    onUpload={(url) => setBranding({ ...branding, full_logo_dark_url: url })}
                    bucket="platform-branding"
                    acceptedTypes={['.png', '.jpg', '.jpeg', '.svg']}
                    type="full-logo"
                  />
                </div>
              </div>

              {/* Favicons Section */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Favicons</h3>
                  <p className="text-xs text-muted-foreground">
                    Small icons (16x16px) shown in browser tabs and bookmarks. Responds to system theme (not app theme toggle).
                  </p>
                </div>
                <div className="space-y-4">
                  <BrandingUpload
                    label="Light Mode"
                    description="Shown when user's operating system is in light mode"
                    currentUrl={branding.favicon_light_url}
                    onUpload={(url) => setBranding({ ...branding, favicon_light_url: url })}
                    bucket="platform-branding"
                    acceptedTypes={['.ico', '.png']}
                    type="favicon"
                  />
                  <BrandingUpload
                    label="Dark Mode"
                    description="Shown when user's operating system is in dark mode"
                    currentUrl={branding.favicon_dark_url}
                    onUpload={(url) => setBranding({ ...branding, favicon_dark_url: url })}
                    bucket="platform-branding"
                    acceptedTypes={['.ico', '.png']}
                    type="favicon"
                  />
                </div>
              </div>

              <Button onClick={saveBranding} disabled={saving}>
                {saving ? 'Saving...' : 'Save Branding'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agent-types" className="space-y-4">
          <AgentTypesSection />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>OpenAI Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openai-key">API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="openai-key"
                      type={showOpenAI ? "text" : "password"}
                      value={apiKeys.openai}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                      placeholder="sk-..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowOpenAI(!showOpenAI)}
                    >
                      {showOpenAI ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button onClick={handleSaveOpenAI} disabled={saving}>
                    Save
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteOpenAI} disabled={saving}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resend Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resend-key">API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="resend-key"
                      type={showResend ? "text" : "password"}
                      value={apiKeys.resend}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, resend: e.target.value }))}
                      placeholder="re_..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowResend(!showResend)}
                    >
                      {showResend ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button onClick={handleSaveResend} disabled={saving}>
                    Save
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteResend} disabled={saving}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stripe Integration</CardTitle>
              <CardDescription>
                Manage Stripe API keys for subscription and payment management.{' '}
                <a 
                  href="https://dashboard.stripe.com/apikeys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  View Stripe Dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label htmlFor="stripe-key">Secret Key (sk_live_... or sk_test_...)</Label>
                    <p className="text-xs text-muted-foreground">
                      Used for creating checkout sessions, syncing plans, and managing subscriptions
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="stripe-key"
                      type={showStripe ? "text" : "password"}
                      value={apiKeys.stripe}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, stripe: e.target.value }))}
                      placeholder="sk_live_... or sk_test_..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowStripe(!showStripe)}
                    >
                      {showStripe ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button onClick={handleSaveStripe} disabled={saving}>
                    Save
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteStripe} disabled={saving}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label htmlFor="stripe-webhook">Webhook Signing Secret (whsec_...)</Label>
                    <p className="text-xs text-muted-foreground">
                      Used to verify webhook events from Stripe. Get this from{' '}
                      <a 
                        href="https://dashboard.stripe.com/webhooks" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Stripe Dashboard → Webhooks
                      </a>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="stripe-webhook"
                      type={showStripeWebhook ? "text" : "password"}
                      value={apiKeys.stripeWebhook}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, stripeWebhook: e.target.value }))}
                      placeholder="whsec_..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowStripeWebhook(!showStripeWebhook)}
                    >
                      {showStripeWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button onClick={handleSaveStripeWebhook} disabled={saving}>
                    Save
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteStripeWebhook} disabled={saving}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label htmlFor="stripe-publishable">Publishable Key (pk_live_... or pk_test_...) - Optional</Label>
                    <p className="text-xs text-muted-foreground">
                      Only needed if you want to use Stripe.js on the frontend for custom payment flows
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="stripe-publishable"
                      type={showStripePublishable ? "text" : "password"}
                      value={apiKeys.stripePublishable}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, stripePublishable: e.target.value }))}
                      placeholder="pk_live_... or pk_test_..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowStripePublishable(!showStripePublishable)}
                    >
                      {showStripePublishable ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button onClick={handleSaveStripePublishable} disabled={saving}>
                    Save
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteStripePublishable} disabled={saving}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
