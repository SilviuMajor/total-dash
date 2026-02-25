import { useEffect, useState } from "react";
import { PageSkeleton } from "@/components/skeletons";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useToast } from "@/hooks/use-toast";
import { Save, AlertTriangle, CheckCircle2, XCircle, Eye, Loader2 } from "lucide-react";
import { AgencyUsersContent } from "@/components/agency-management/AgencyUsersContent";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BrandingUpload } from "@/components/BrandingUpload";

export default function AgencySettings() {
  const { profile, isPreviewMode, previewAgency, userType, previewDepth } = useMultiTenantAuth();
  const effectiveIsPreviewMode = userType === 'super_admin' && previewDepth === 'agency';
  const effectiveAgencyId = effectiveIsPreviewMode ? previewAgency?.id : profile?.agency?.id;
  const { toast } = useToast();
  interface AgencyRow {
    id: string;
    name: string;
    slug: string;
    original_slug?: string;
    support_email: string | null;
    logo_light_url: string | null;
    logo_dark_url: string | null;
    full_logo_light_url: string | null;
    full_logo_dark_url: string | null;
    favicon_light_url: string | null;
    favicon_dark_url: string | null;
    whitelabel_domain: string | null;
    whitelabel_subdomain: string | null;
    whitelabel_verified: boolean | null;
    whitelabel_verified_at: string | null;
    primary_color: string | null;
    secondary_color: string | null;
  }

  const [agency, setAgency] = useState<AgencyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showSlugWarning, setShowSlugWarning] = useState(false);
  const [pendingSlug, setPendingSlug] = useState("");
  const [hasWhitelabel, setHasWhitelabel] = useState<boolean>(false);
  const [clientLoginUrl, setClientLoginUrl] = useState('/client/login');
  const [clientLoginLoading, setClientLoginLoading] = useState(true);

  // Check whitelabel access using database function
  useEffect(() => {
    const checkWhitelabelAccess = async () => {
      if (!effectiveAgencyId) {
        setHasWhitelabel(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('has_whitelabel_access', {
          _agency_id: effectiveAgencyId
        });

      if (error) {
        setHasWhitelabel(false);
        return;
      }

      setHasWhitelabel(data || false);
    } catch (err) {
      console.error('[AgencySettings] Failed to check whitelabel access:', err);
      setHasWhitelabel(false);
    }
    };

    checkWhitelabelAccess();
  }, [effectiveAgencyId]);

  // Fetch agency domain for login preview URL
  useEffect(() => {
    const fetchAgencyDomain = async () => {
      setClientLoginLoading(true);
      if (!effectiveAgencyId) {
        setClientLoginLoading(false);
        return;
      }
      
      const { data: agencyData } = await supabase
        .from('agencies')
        .select('slug, whitelabel_domain, whitelabel_subdomain, whitelabel_verified')
        .eq('id', effectiveAgencyId)
        .single();
      
      if (agencyData?.whitelabel_verified && agencyData?.whitelabel_domain) {
        const subdomain = agencyData.whitelabel_subdomain || 'dashboard';
        setClientLoginUrl(`https://${subdomain}.${agencyData.whitelabel_domain}/client/login?preview=true`);
      } else if (agencyData?.slug) {
        const baseUrl = window.location.origin;
        setClientLoginUrl(`${baseUrl}/login/${agencyData.slug}?preview=true`);
      } else {
        setClientLoginUrl('/client/login?preview=true');
      }
      setClientLoginLoading(false);
    };

    fetchAgencyDomain();
  }, [effectiveAgencyId]);

  useEffect(() => {
    loadAgency();
  }, [profile]);

  const loadAgency = async () => {
    if (!effectiveAgencyId) return;

    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .eq('id', effectiveAgencyId)
        .single();

      if (error) throw error;
      setAgency({ ...data, original_slug: data.slug });
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

  const handleSlugChange = (newSlug: string) => {
    const normalized = newSlug.toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/^-+|-+$/g, '');
    setPendingSlug(normalized);
    setShowSlugWarning(true);
  };

  const confirmSlugChange = () => {
    setAgency({ ...agency, slug: pendingSlug });
    setShowSlugWarning(false);
  };

  const handleVerifyDomain = async () => {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-whitelabel-domain', {
        body: {
          agencyId: effectiveAgencyId,
          domain: agency.whitelabel_domain,
          subdomain: agency.whitelabel_subdomain || 'dashboard',
        },
      });

      if (error) throw error;

      toast({
        title: data.verified ? "Success" : "Verification Failed",
        description: data.message,
        variant: data.verified ? "default" : "destructive",
      });

      // Reload agency to get updated verification status
      await loadAgency();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updateData: any = {
        name: agency.name,
        support_email: agency.support_email,
        logo_light_url: agency.logo_light_url,
        logo_dark_url: agency.logo_dark_url,
        full_logo_light_url: agency.full_logo_light_url,
        full_logo_dark_url: agency.full_logo_dark_url,
        favicon_light_url: agency.favicon_light_url,
        favicon_dark_url: agency.favicon_dark_url,
      };

      // Only update slug if it's different from current
      if (agency.slug && agency.slug !== agency.original_slug) {
        updateData.slug = agency.slug;
      }

      // Only update whitelabel fields if whitelabel access is enabled
      if (hasWhitelabel) {
        updateData.whitelabel_subdomain = agency.whitelabel_subdomain;
        updateData.whitelabel_domain = agency.whitelabel_domain;
      }

      const { error } = await supabase
        .from('agencies')
        .update(updateData)
        .eq('id', effectiveAgencyId);

      if (error) throw error;

      // Auto-verify domain if both subdomain and domain are set
      if (hasWhitelabel && agency.whitelabel_domain && agency.whitelabel_subdomain) {
        await handleVerifyDomain();
      }

      toast({
        title: "Success",
        description: "Settings updated successfully",
      });
      
      // Reload to get latest data
      await loadAgency();
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

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your agency settings</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          {hasWhitelabel && (
            <TabsTrigger value="whitelabel">Whitelabel</TabsTrigger>
          )}
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label>Agency Name</Label>
                  <Input
                    value={agency?.name || ''}
                    onChange={(e) => setAgency({ ...agency, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Agency Slug (URL Path)</Label>
                  <Input
                    value={agency?.slug || ''}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="your-agency"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your agency dashboard: <span className="font-mono">total-dash.com/{agency?.slug || 'your-agency'}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input
                    type="email"
                    value={agency?.support_email || ''}
                    onChange={(e) => setAgency({ ...agency, support_email: e.target.value })}
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whitelabel" className="space-y-6">
          {!hasWhitelabel ? (
            <Card>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h3 className="text-lg font-semibold">Whitelabel Features</h3>
                  <p className="text-sm text-muted-foreground">
                    Upgrade to access custom branding and domain features
                  </p>
                </div>
                <Button>Upgrade Plan</Button>
              </CardContent>
            </Card>
          ) : (
            <>
            <Card>
              <CardHeader>
                <CardTitle>Whitelabel Settings</CardTitle>
                <CardDescription>
                  Customize branding for your client dashboards. These settings override platform branding only for your clients.
                </CardDescription>
              </CardHeader>
              <CardContent>
              <form onSubmit={handleSave} className="space-y-6">
                  <div className="space-y-2 mb-4">
                    <h3 className="text-sm font-semibold">Client-Facing Branding Override</h3>
                    <p className="text-xs text-muted-foreground">
                      These settings allow you to customize the branding that YOUR CLIENTS see when they log in and use their dashboards. Any element you don't upload will automatically show the platform's default branding.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <BrandingUpload
                      label="Sidebar Logo (Light Mode)"
                      description="Square logo shown in client sidebar (light theme). Leave empty to show platform default."
                      currentUrl={agency?.logo_light_url}
                      onUpload={(url) => setAgency({ ...agency, logo_light_url: url })}
                      bucket="agency-logos"
                      acceptedTypes={['.png', '.jpg', '.jpeg', '.svg']}
                      type="logo"
                    />

                    <BrandingUpload
                      label="Sidebar Logo (Dark Mode)"
                      description="Square logo shown in client sidebar (dark theme). Leave empty to show platform default."
                      currentUrl={agency?.logo_dark_url}
                      onUpload={(url) => setAgency({ ...agency, logo_dark_url: url })}
                      bucket="agency-logos"
                      acceptedTypes={['.png', '.jpg', '.jpeg', '.svg']}
                      type="logo"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <BrandingUpload
                      label="Full Logo (Light Mode)"
                      description="Wide format logo for client login page (light theme). Client sees this on login screen at your custom domain. Leave empty to show platform default."
                      currentUrl={agency?.full_logo_light_url}
                      onUpload={(url) => setAgency({ ...agency, full_logo_light_url: url })}
                      bucket="agency-logos"
                      acceptedTypes={['.png', '.jpg', '.jpeg', '.svg']}
                      type="full-logo"
                    />

                    <BrandingUpload
                      label="Full Logo (Dark Mode)"
                      description="Wide format logo for client login page (dark theme). Client sees this on login screen at your custom domain. Leave empty to show platform default."
                      currentUrl={agency?.full_logo_dark_url}
                      onUpload={(url) => setAgency({ ...agency, full_logo_dark_url: url })}
                      bucket="agency-logos"
                      acceptedTypes={['.png', '.jpg', '.jpeg', '.svg']}
                      type="full-logo"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <BrandingUpload
                      label="Favicon (Light Mode)"
                      description="Browser tab icon for client dashboard (light theme). Leave empty to show platform default."
                      currentUrl={agency?.favicon_light_url}
                      onUpload={(url) => setAgency({ ...agency, favicon_light_url: url })}
                      bucket="agency-logos"
                      acceptedTypes={['.ico', '.png']}
                      type="favicon"
                    />

                    <BrandingUpload
                      label="Favicon (Dark Mode)"
                      description="Browser tab icon for client dashboard (dark theme). Leave empty to show platform default."
                      currentUrl={agency?.favicon_dark_url}
                      onUpload={(url) => setAgency({ ...agency, favicon_dark_url: url })}
                      bucket="agency-logos"
                      acceptedTypes={['.ico', '.png']}
                      type="favicon"
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Custom Domain</h3>
                    <p className="text-sm text-muted-foreground">
                      Set up a custom domain so your clients access their dashboard via your own branded URL (e.g., dashboard.youragency.com).
                    </p>

                    <div className="space-y-2">
                      <Label>Subdomain Prefix</Label>
                      <Input
                        value={agency?.whitelabel_subdomain || 'dashboard'}
                        onChange={(e) => setAgency({ ...agency, whitelabel_subdomain: e.target.value })}
                        placeholder="dashboard"
                      />
                      <p className="text-xs text-muted-foreground">
                        This is the subdomain your clients will use (e.g., <span className="font-mono">dashboard</span>)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Your Domain</Label>
                      <Input
                        value={agency?.whitelabel_domain || ''}
                        onChange={(e) => setAgency({ ...agency, whitelabel_domain: e.target.value })}
                        placeholder="youragency.com"
                      />
                      <p className="text-xs text-muted-foreground">
                        Full URL: <span className="font-mono font-semibold">{agency?.whitelabel_subdomain || 'dashboard'}.{agency?.whitelabel_domain || 'youragency.com'}</span>
                      </p>
                    </div>

                    {agency?.whitelabel_domain && (
                      <Alert variant={agency?.whitelabel_verified ? "default" : "destructive"}>
                        <div className="flex items-center gap-2">
                          {agency?.whitelabel_verified ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              <AlertDescription>
                                Domain verified {agency?.whitelabel_verified_at && `on ${new Date(agency.whitelabel_verified_at).toLocaleDateString()}`}
                              </AlertDescription>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4" />
                              <AlertDescription>Domain not verified</AlertDescription>
                            </>
                          )}
                        </div>
                      </Alert>
                    )}

                    {agency?.whitelabel_domain && !agency?.whitelabel_verified && (
                      <div className="space-y-3 p-4 bg-muted rounded-lg">
                        <p className="text-sm font-semibold">DNS Configuration Required:</p>
                        <p className="text-xs text-muted-foreground">
                          Add a CNAME record in your domain registrar's DNS settings to point to our platform.
                        </p>
                        <ol className="text-xs space-y-2 list-decimal list-inside">
                          <li>Log into your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)</li>
                          <li>Go to DNS settings for <span className="font-mono font-semibold">{agency?.whitelabel_domain}</span></li>
                          <li>Add a CNAME record:
                            <div className="mt-1 p-3 bg-background rounded font-mono text-xs border">
                              <div><span className="text-muted-foreground">Type:</span> CNAME</div>
                              <div><span className="text-muted-foreground">Name:</span> {agency?.whitelabel_subdomain || 'dashboard'}</div>
                              <div><span className="text-muted-foreground">Target:</span> totaldash-proxy.workers.dev</div>
                            </div>
                          </li>
                          <li>Wait 5-10 minutes for DNS propagation</li>
                          <li>Click "Verify Domain" below</li>
                        </ol>
                        <Button 
                          type="button" 
                          onClick={handleVerifyDomain} 
                          disabled={verifying}
                          variant="outline"
                          className="w-full"
                        >
                          {verifying ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Verifying...
                            </>
                          ) : 'Verify Domain'}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Primary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={agency?.primary_color || '#000000'}
                          onChange={(e) => setAgency({ ...agency, primary_color: e.target.value })}
                          className="w-20"
                        />
                        <Input
                          value={agency?.primary_color || '#000000'}
                          onChange={(e) => setAgency({ ...agency, primary_color: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Secondary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={agency?.secondary_color || '#ffffff'}
                          onChange={(e) => setAgency({ ...agency, secondary_color: e.target.value })}
                          className="w-20"
                        />
                        <Input
                          value={agency?.secondary_color || '#ffffff'}
                          onChange={(e) => setAgency({ ...agency, secondary_color: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Whitelabel Settings'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Login Preview Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Login Preview</CardTitle>
                <CardDescription>
                  Preview how your clients will see the login page with your branding applied
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => window.open(clientLoginUrl, '_blank')}
                  disabled={clientLoginLoading}
                >
                  {clientLoginLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  Login Preview
                </Button>
              </CardContent>
            </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <AgencyUsersContent agencyId={effectiveAgencyId} />
        </TabsContent>
      </Tabs>

      {/* Slug change warning dialog */}
      <AlertDialog open={showSlugWarning} onOpenChange={setShowSlugWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Change Agency URL?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Changing your agency slug will update your dashboard URL from:
              </p>
              <div className="p-3 bg-muted rounded font-mono text-sm">
                <div className="line-through text-muted-foreground">total-dash.com/{agency?.original_slug}</div>
                <div className="text-foreground font-semibold mt-1">total-dash.com/{pendingSlug}</div>
              </div>
              <p className="text-destructive font-semibold">
                ⚠️ This will affect all links and bookmarks to your agency dashboard. Make sure to update any saved links.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSlug("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSlugChange}>
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
