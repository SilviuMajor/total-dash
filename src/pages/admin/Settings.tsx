import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, UserCog, Trash2, Brain, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AgencyLogoUpload } from "@/components/agency-management/AgencyLogoUpload";
import { AgentTypesSection } from "@/components/agency-management/AgentTypesSection";

interface AgencyMember {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export default function AdminSettings() {
  const [members, setMembers] = useState<AgencyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [agencyDomain, setAgencyDomain] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [agencyLogoUrl, setAgencyLogoUrl] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  
  // API Keys state
  const [apiKeys, setApiKeys] = useState({
    openai: { connected: false, maskedValue: '' },
    elevenLabs: { connected: false, maskedValue: '' },
  });
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [disconnectingKey, setDisconnectingKey] = useState<'openai' | 'elevenLabs' | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [connectingKey, setConnectingKey] = useState<'openai' | 'elevenLabs' | null>(null);
  const [loadingKeys, setLoadingKeys] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    loadMembers();
    loadAgencySettings();
    loadApiKeyStatuses();
  }, []);

  const loadAgencySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_settings')
        .select('agency_domain, agency_name, agency_logo_url')
        .maybeSingle();

      if (error) throw error;
      setAgencyDomain(data?.agency_domain || "");
      setAgencyName(data?.agency_name || "");
      setAgencyLogoUrl(data?.agency_logo_url || "");
    } catch (error) {
      console.error('Error loading agency settings:', error);
    }
  };

  const handleLogoUpload = async (url: string) => {
    setAgencyLogoUrl(url);
    
    try {
      const { data: settingsData } = await supabase
        .from('agency_settings')
        .select('id')
        .maybeSingle();

      if (settingsData?.id) {
        await supabase
          .from('agency_settings')
          .update({ agency_logo_url: url })
          .eq('id', settingsData.id);
      }
    } catch (error) {
      console.error('Error saving logo:', error);
    }
  };

  const handleSaveAgencySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);

    try {
      const { data: settingsData } = await supabase
        .from('agency_settings')
        .select('id')
        .single();

      const { error } = await supabase
        .from('agency_settings')
        .update({ 
          agency_domain: agencyDomain,
          agency_name: agencyName,
          agency_logo_url: agencyLogoUrl
        })
        .eq('id', settingsData?.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Agency settings updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // API Key Management Functions
  const loadApiKeyStatuses = async () => {
    try {
      setLoadingKeys(true);
      const [openaiResult, elevenLabsResult] = await Promise.all([
        supabase.functions.invoke('get-api-key-status', {
          body: { keyName: 'OPENAI_API_KEY' }
        }),
        supabase.functions.invoke('get-api-key-status', {
          body: { keyName: 'ELEVENLABS_API_KEY' }
        })
      ]);

      setApiKeys({
        openai: {
          connected: openaiResult.data?.exists || false,
          maskedValue: openaiResult.data?.maskedValue || ''
        },
        elevenLabs: {
          connected: elevenLabsResult.data?.exists || false,
          maskedValue: elevenLabsResult.data?.maskedValue || ''
        }
      });
    } catch (error) {
      console.error('Error loading API key statuses:', error);
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleConnectKey = async (keyType: 'openai' | 'elevenLabs') => {
    if (!newKeyValue.trim()) {
      toast({
        title: "Error",
        description: "Please enter an API key",
        variant: "destructive",
      });
      return;
    }

    const keyName = keyType === 'openai' ? 'OPENAI_API_KEY' : 'ELEVENLABS_API_KEY';
    
    try {
      setLoadingKeys(true);
      const { error } = await supabase.functions.invoke('save-api-key', {
        body: { keyName, keyValue: newKeyValue }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${keyType === 'openai' ? 'OpenAI' : 'Eleven Labs'} API key connected successfully`,
      });

      setNewKeyValue('');
      setConnectingKey(null);
      await loadApiKeyStatuses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save API key",
        variant: "destructive",
      });
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectingKey || !adminPassword) return;

    const keyName = disconnectingKey === 'openai' ? 'OPENAI_API_KEY' : 'ELEVENLABS_API_KEY';
    
    try {
      setLoadingKeys(true);
      const { error } = await supabase.functions.invoke('delete-api-key', {
        body: { keyName, adminPassword }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${disconnectingKey === 'openai' ? 'OpenAI' : 'Eleven Labs'} API key disconnected`,
      });

      setShowPasswordDialog(false);
      setAdminPassword('');
      setDisconnectingKey(null);
      await loadApiKeyStatuses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect API key",
        variant: "destructive",
      });
    } finally {
      setLoadingKeys(false);
    }
  };

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'admin')
        .order('email');

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error loading members:', error);
      toast({
        title: "Error",
        description: "Failed to load agency members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Note: This creates a basic profile. In production, you'd send an invitation email
      // and create the account when they accept the invitation
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newMemberEmail,
        email_confirm: true,
        user_metadata: {
          full_name: newMemberName,
          role: 'admin'
        }
      });

      if (authError) throw authError;

      toast({
        title: "Success",
        description: "Agency member invited successfully",
      });

      setNewMemberEmail("");
      setNewMemberName("");
      setOpen(false);
      loadMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this agency member?")) return;

    try {
      const { error } = await supabase.auth.admin.deleteUser(memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Agency member removed successfully",
      });

      loadMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Agency Settings</h1>
        <p className="text-muted-foreground">Configure your agency and manage integrations</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-muted">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="agent-types">Agent Types</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-2xl">Agency Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveAgencySettings} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="agency_name">Agency Name</Label>
                  <Input
                    id="agency_name"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Your Agency Name"
                    className="bg-muted/50 border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    This name will appear in the sidebar across all dashboards
                  </p>
                </div>

                <AgencyLogoUpload
                  currentUrl={agencyLogoUrl}
                  onUploadComplete={handleLogoUpload}
                />
                <p className="text-xs text-muted-foreground -mt-4">
                  This logo will appear in the top-right of all dashboards and in the sidebar
                </p>

                <div className="space-y-2">
                  <Label htmlFor="agency_domain">Client Portal Domain</Label>
                  <Input
                    id="agency_domain"
                    value={agencyDomain}
                    onChange={(e) => setAgencyDomain(e.target.value)}
                    placeholder="dashboard.youragency.com"
                    className="bg-muted/50 border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Universal domain where all clients sign in
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={savingSettings}
                  className="bg-foreground text-background hover:bg-foreground/90"
                >
                  {savingSettings ? "Saving..." : "Save Settings"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agent Types Tab */}
        <TabsContent value="agent-types">
          <AgentTypesSection />
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">

          {/* API Integrations Section */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-2xl">API Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-6">Manage your API keys for third-party integrations</p>
              
              <div className="space-y-6">
                {/* OpenAI Integration */}
                <div className="border border-border/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">OpenAI API Key</h4>
                      <p className="text-xs text-muted-foreground">Connect your OpenAI account</p>
                    </div>
                    <Badge variant={apiKeys.openai.connected ? "default" : "secondary"} className="ml-auto">
                      {apiKeys.openai.connected ? "Connected" : "Not Connected"}
                    </Badge>
                  </div>

                  {apiKeys.openai.connected ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                        <code className="text-xs font-mono flex-1">{apiKeys.openai.maskedValue}</code>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setDisconnectingKey('openai');
                          setShowPasswordDialog(true);
                        }}
                        disabled={loadingKeys}
                      >
                        Disconnect
                      </Button>
                    </div>
                  ) : connectingKey === 'openai' ? (
                    <div className="space-y-3">
                      <Input
                        type="password"
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        placeholder="sk-..."
                        className="bg-muted/50 border-border font-mono text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleConnectKey('openai')}
                          disabled={loadingKeys}
                          className="bg-foreground text-background hover:bg-foreground/90"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setConnectingKey(null);
                            setNewKeyValue('');
                          }}
                          disabled={loadingKeys}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConnectingKey('openai')}
                      disabled={loadingKeys}
                    >
                      Connect
                    </Button>
                  )}
                </div>

                {/* Eleven Labs Integration */}
                <div className="border border-border/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Mic className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">Eleven Labs API Key</h4>
                      <p className="text-xs text-muted-foreground">Connect your Eleven Labs account</p>
                    </div>
                    <Badge variant={apiKeys.elevenLabs.connected ? "default" : "secondary"} className="ml-auto">
                      {apiKeys.elevenLabs.connected ? "Connected" : "Not Connected"}
                    </Badge>
                  </div>

                  {apiKeys.elevenLabs.connected ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                        <code className="text-xs font-mono flex-1">{apiKeys.elevenLabs.maskedValue}</code>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setDisconnectingKey('elevenLabs');
                          setShowPasswordDialog(true);
                        }}
                        disabled={loadingKeys}
                      >
                        Disconnect
                      </Button>
                    </div>
                  ) : connectingKey === 'elevenLabs' ? (
                    <div className="space-y-3">
                      <Input
                        type="password"
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        placeholder="Enter API key..."
                        className="bg-muted/50 border-border font-mono text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleConnectKey('elevenLabs')}
                          disabled={loadingKeys}
                          className="bg-foreground text-background hover:bg-foreground/90"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setConnectingKey(null);
                            setNewKeyValue('');
                          }}
                          disabled={loadingKeys}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConnectingKey('elevenLabs')}
                      disabled={loadingKeys}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">

          {/* Password Verification Dialog */}
          <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Disconnection</AlertDialogTitle>
                <AlertDialogDescription className="space-y-4">
                  <p>Enter your admin password to disconnect {disconnectingKey === 'openai' ? 'OpenAI' : 'Eleven Labs'} API key:</p>
                  <Input
                    type="password"
                    placeholder="Admin password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="bg-muted/50 border-border"
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => {
                  setAdminPassword('');
                  setDisconnectingKey(null);
                }}>
                  Cancel
                </AlertDialogCancel>
                <Button
                  onClick={handleDisconnect}
                  disabled={!adminPassword || loadingKeys}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {loadingKeys ? "Disconnecting..." : "Confirm"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center justify-between">
                <span>Agency Team Members</span>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-foreground text-background hover:bg-foreground/90 gap-2">
                      <Plus className="w-4 h-4" />
                      Invite Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border">
                    <DialogHeader>
                      <DialogTitle>Invite Agency Member</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleInviteMember} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="memberName">Full Name</Label>
                        <Input
                          id="memberName"
                          value={newMemberName}
                          onChange={(e) => setNewMemberName(e.target.value)}
                          placeholder="John Doe"
                          required
                          className="bg-muted/50 border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="memberEmail">Email Address</Label>
                        <Input
                          id="memberEmail"
                          type="email"
                          value={newMemberEmail}
                          onChange={(e) => setNewMemberEmail(e.target.value)}
                          placeholder="john@agency.com"
                          required
                          className="bg-muted/50 border-border"
                        />
                      </div>
                      <Button type="submit" className="w-full bg-foreground text-background hover:bg-foreground/90">
                        Send Invitation
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse"></div>
                  ))}
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No agency members yet. Invite your first team member!
                </div>
              ) : (
                <div className="space-y-4">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <UserCog className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{member.full_name || "Unnamed Member"}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="capitalize">Admin</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
