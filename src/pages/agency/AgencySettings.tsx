import { useEffect, useState } from "react";
import { PageSkeleton } from "@/components/skeletons";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useToast } from "@/hooks/use-toast";
import { Save, AlertTriangle, Eye, Loader2 } from "lucide-react";
import { AgencyUsersContent } from "@/components/agency-management/AgencyUsersContent";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BrandingUpload } from "@/components/BrandingUpload";
import { LoginURLDisplay } from "@/components/LoginURLDisplay";
import { CustomDomainCard } from "@/components/whitelabel/CustomDomainCard";
import { getAgencyLoginUrl, getClientLoginUrl } from "@/lib/login-urls";

const RESERVED_SLUGS = [
  'admin', 'agency', 'client', 'login', 'portal', 'api', 'app',
  'reset-password', 'change-password', 'transcripts', 'analytics',
  'knowledge-base', 'agent-settings', 'specs', 'guides', 'settings',
  'dashboard', 'auth', 'signup', 'register', 'help', 'support',
  'billing', 'pricing', 'terms', 'privacy', 'status',
  'contact', 'about',
];

export default function AgencySettings() {
  const { profile, isPreviewMode, previewAgency, userType, previewDepth } = useMultiTenantAuth();
  const { activeSession } = useImpersonation();
  const effectiveIsPreviewMode = userType === 'super_admin' && previewDepth === 'agency';
  const effectiveAgencyId = profile?.agency?.id 
    || previewAgency?.id 
    || activeSession?.agency_id 
    || sessionStorage.getItem('preview_agency') 
    || undefined;
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
  const [showSlugWarning, setShowSlugWarning] = useState(false);
  const [pendingSlug, setPendingSlug] = useState("");
  const [slugValidationError, setSlugValidationError] = useState('');
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [hasWhitelabel, setHasWhitelabel] = useState<boolean>(false);

  // URLs derived directly from `agency` state (loaded by loadAgency()) via
  // the central helper so whitelabel awareness is single-sourced.
  const agencyLoginUrl = getAgencyLoginUrl(agency);
  const clientLoginUrlBase = getClientLoginUrl(agency);
  // Login Preview button needs ?preview=true appended so the rendered Auth
  // page enters preview mode and short-circuits the post-auth redirect.
  const clientLoginPreviewUrl = clientLoginUrlBase
    ? `${clientLoginUrlBase}${clientLoginUrlBase.includes('?') ? '&' : '?'}preview=true`
    : '';

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

  const confirmSlugChange = () => {
    setShowSlugWarning(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agency || !effectiveAgencyId) return;
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

      // Whitelabel domain + subdomain are managed by CustomDomainCard via the
      // whitelabel-domain-actions Edge Function (not this generic save).

      const { error } = await supabase
        .from('agencies')
        .update(updateData)
        .eq('id', effectiveAgencyId);

      if (error) throw error;

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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your agency settings</p>
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
          {agency && (
            <div className="grid gap-3 md:grid-cols-2">
              <LoginURLDisplay
                label="Agency staff login"
                description="Where you and your team sign in."
                url={agencyLoginUrl}
              />
              <LoginURLDisplay
                label="Client login URL"
                description="Share this with your clients."
                url={clientLoginUrlBase}
              />
            </div>
          )}
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
                    onChange={(e) => setAgency(prev => prev ? { ...prev, name: e.target.value } : prev)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Agency Slug (URL Path)</Label>
                  <Input
                    value={agency?.slug || ''}
                    onChange={(e) => {
                      const normalized = e.target.value.toLowerCase()
                        .replace(/[^a-z0-9-]/g, '')
                        .replace(/^-+|-+$/g, '');
                      setAgency(prev => prev ? { ...prev, slug: normalized } : prev);
                      setSlugValidationError('');
                    }}
                    onBlur={async () => {
                      if (!agency?.slug || agency.slug === agency.original_slug) return;
                      if (agency.slug.length < 3) {
                        setSlugValidationError('Slug must be at least 3 characters');
                        return;
                      }
                      if (RESERVED_SLUGS.includes(agency.slug)) {
                        setSlugValidationError(`"${agency.slug}" is reserved and cannot be used`);
                        return;
                      }
                      setSlugValidationError('');
                      setCheckingSlug(true);
                      try {
                        const { data: existing } = await supabase
                          .from('agencies')
                          .select('id')
                          .eq('slug', agency.slug)
                          .neq('id', effectiveAgencyId || '')
                          .maybeSingle();
                        if (existing) {
                          setSlugValidationError('This slug is already taken');
                          setCheckingSlug(false);
                          return;
                        }
                      } catch {}
                      setCheckingSlug(false);
                      setShowSlugWarning(true);
                    }}
                    placeholder="your-agency"
                  />
                  {slugValidationError && (
                    <p className="text-sm text-destructive mt-1">{slugValidationError}</p>
                  )}
                  {checkingSlug && (
                    <p className="text-sm text-muted-foreground mt-1">Checking availability...</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Your agency dashboard: <span className="font-mono">total-dash.com/{agency?.slug || 'your-agency'}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input
                    type="email"
                    value={agency?.support_email || ''}
                    onChange={(e) => setAgency(prev => prev ? { ...prev, support_email: e.target.value } : prev)}
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
            {agency && (
              <CustomDomainCard agency={agency} onUpdate={loadAgency} />
            )}
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
                      currentUrl={agency?.logo_light_url ?? undefined}
                      onUpload={(url) => setAgency(prev => prev ? { ...prev, logo_light_url: url } : prev)}
                      bucket="agency-logos"
                      acceptedTypes={['.png', '.jpg', '.jpeg', '.svg']}
                      type="logo"
                    />

                    <BrandingUpload
                      label="Sidebar Logo (Dark Mode)"
                      description="Square logo shown in client sidebar (dark theme). Leave empty to show platform default."
                      currentUrl={agency?.logo_dark_url ?? undefined}
                      onUpload={(url) => setAgency(prev => prev ? { ...prev, logo_dark_url: url } : prev)}
                      bucket="agency-logos"
                      acceptedTypes={['.png', '.jpg', '.jpeg', '.svg']}
                      type="logo"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <BrandingUpload
                      label="Full Logo (Light Mode)"
                      description="Wide format logo for client login page (light theme). Client sees this on login screen at your custom domain. Leave empty to show platform default."
                      currentUrl={agency?.full_logo_light_url ?? undefined}
                      onUpload={(url) => setAgency(prev => prev ? { ...prev, full_logo_light_url: url } : prev)}
                      bucket="agency-logos"
                      acceptedTypes={['.png', '.jpg', '.jpeg', '.svg']}
                      type="full-logo"
                    />

                    <BrandingUpload
                      label="Full Logo (Dark Mode)"
                      description="Wide format logo for client login page (dark theme). Client sees this on login screen at your custom domain. Leave empty to show platform default."
                      currentUrl={agency?.full_logo_dark_url ?? undefined}
                      onUpload={(url) => setAgency(prev => prev ? { ...prev, full_logo_dark_url: url } : prev)}
                      bucket="agency-logos"
                      acceptedTypes={['.png', '.jpg', '.jpeg', '.svg']}
                      type="full-logo"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <BrandingUpload
                      label="Favicon (Light Mode)"
                      description="Browser tab icon for client dashboard (light theme). Leave empty to show platform default."
                      currentUrl={agency?.favicon_light_url ?? undefined}
                      onUpload={(url) => setAgency(prev => prev ? { ...prev, favicon_light_url: url } : prev)}
                      bucket="agency-logos"
                      acceptedTypes={['.ico', '.png']}
                      type="favicon"
                    />

                    <BrandingUpload
                      label="Favicon (Dark Mode)"
                      description="Browser tab icon for client dashboard (dark theme). Leave empty to show platform default."
                      currentUrl={agency?.favicon_dark_url ?? undefined}
                      onUpload={(url) => setAgency(prev => prev ? { ...prev, favicon_dark_url: url } : prev)}
                      bucket="agency-logos"
                      acceptedTypes={['.ico', '.png']}
                      type="favicon"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Primary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={agency?.primary_color || '#000000'}
                          onChange={(e) => setAgency(prev => prev ? { ...prev, primary_color: e.target.value } : prev)}
                          className="w-20"
                        />
                        <Input
                          value={agency?.primary_color || '#000000'}
                          onChange={(e) => setAgency(prev => prev ? { ...prev, primary_color: e.target.value } : prev)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Secondary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={agency?.secondary_color || '#ffffff'}
                          onChange={(e) => setAgency(prev => prev ? { ...prev, secondary_color: e.target.value } : prev)}
                          className="w-20"
                        />
                        <Input
                          value={agency?.secondary_color || '#ffffff'}
                          onChange={(e) => setAgency(prev => prev ? { ...prev, secondary_color: e.target.value } : prev)}
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
                  onClick={() => window.open(clientLoginPreviewUrl, '_blank')}
                  disabled={!agency || !clientLoginPreviewUrl}
                >
                  {!agency ? (
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
              <AlertTriangle className="h-5 w-5 text-sand-fg" />
              Change Agency URL?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Changing your agency slug will update your dashboard URL from:
              </p>
              <div className="p-3 bg-muted rounded font-mono text-sm">
                <div className="line-through text-muted-foreground">total-dash.com/login/{agency?.original_slug}</div>
                <div className="text-foreground font-semibold mt-1">total-dash.com/login/{agency?.slug}</div>
              </div>
              <p className="text-destructive font-semibold">
                ⚠️ This will affect all links and bookmarks to your agency dashboard. Make sure to update any saved links.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setAgency(prev => prev ? { ...prev, slug: prev.original_slug || '' } : prev);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSlugChange} disabled={!!slugValidationError || checkingSlug}>
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
