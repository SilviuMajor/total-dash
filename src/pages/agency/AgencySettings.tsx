import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";
import { AgencyLogoUpload } from "@/components/agency-management/AgencyLogoUpload";
import { AgencyUsersContent } from "@/components/agency-management/AgencyUsersContent";

export default function AgencySettings() {
  const { profile, isPreviewMode, previewAgency } = useMultiTenantAuth();
  const agencyId = isPreviewMode ? previewAgency?.id : profile?.agency?.id;
  const { toast } = useToast();
  const [agency, setAgency] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      setAgency(data);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('agencies')
        .update({
          name: agency.name,
          logo_url: agency.logo_url,
          custom_domain: agency.custom_domain,
          primary_color: agency.primary_color,
          secondary_color: agency.secondary_color,
        })
        .eq('id', agencyId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Settings updated successfully",
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
                  
                  <div className="space-y-2">
                    <Label>Custom Domain</Label>
                    <Input
                      value={agency?.custom_domain || ''}
                      onChange={(e) => setAgency({ ...agency, custom_domain: e.target.value })}
                      placeholder="dashboard.youragency.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your clients will access their dashboard at this domain
                    </p>
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
    </div>
  );
}
