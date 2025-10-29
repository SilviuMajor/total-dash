import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useToast } from "@/hooks/use-toast";
import { Save, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { AgencyLogoUpload } from "@/components/agency-management/AgencyLogoUpload";
import { AgencyUsersContent } from "@/components/agency-management/AgencyUsersContent";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AgencySettings() {
  const { profile, isPreviewMode, previewAgency } = useMultiTenantAuth();
  const agencyId = isPreviewMode ? previewAgency?.id : profile?.agency?.id;
  const { toast } = useToast();
  const [agency, setAgency] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showSlugWarning, setShowSlugWarning] = useState(false);
  const [pendingSlug, setPendingSlug] = useState("");
  const hasWhitelabel = profile?.agency?.has_whitelabel_access;

  useEffect(() => {
    loadAgency();
  }, [profile]);

  const loadAgency = async () => {
    if (!agencyId) return;

    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .eq('id', agencyId)
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
          agencyId,
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
        logo_url: agency.logo_url,
        primary_color: agency.primary_color,
        secondary_color: agency.secondary_color,
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
        .eq('id', agencyId);

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
    return <div className="p-8">Loading...</div>;
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
            <Card>
              <CardHeader>
                <CardTitle>Whitelabel Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-6">
                  <AgencyLogoUpload
                    currentUrl={agency?.logo_url}
                    onUploadComplete={(url) => setAgency({ ...agency, logo_url: url })}
                  />
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Whitelabel Subdomain</Label>
                      <Input
                        value={agency?.whitelabel_subdomain || 'dashboard'}
                        onChange={(e) => setAgency({ ...agency, whitelabel_subdomain: e.target.value })}
                        placeholder="dashboard"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Whitelabel Domain</Label>
                      <Input
                        value={agency?.whitelabel_domain || ''}
                        onChange={(e) => setAgency({ ...agency, whitelabel_domain: e.target.value })}
                        placeholder="youragency.com"
                      />
                      <p className="text-xs text-muted-foreground">
                        Full domain: <span className="font-mono">{agency?.whitelabel_subdomain || 'dashboard'}.{agency?.whitelabel_domain || 'youragency.com'}</span>
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
                        <ol className="text-xs space-y-2 list-decimal list-inside">
                          <li>Go to your domain registrar's DNS settings</li>
                          <li>Add a CNAME record:
                            <div className="mt-1 p-2 bg-background rounded font-mono text-xs">
                              Name: {agency?.whitelabel_subdomain || 'dashboard'}<br/>
                              Type: CNAME<br/>
                              Value: your-project.supabase.co
                            </div>
                          </li>
                          <li>Click "Verify Domain" below after adding the record</li>
                        </ol>
                        <Button 
                          type="button" 
                          onClick={handleVerifyDomain} 
                          disabled={verifying}
                          variant="outline"
                          className="w-full"
                        >
                          {verifying ? 'Verifying...' : 'Verify Domain'}
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
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <AgencyUsersContent agencyId={agencyId} />
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
