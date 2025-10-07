import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, UserCog, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AgencyLogoUpload } from "@/components/agency-management/AgencyLogoUpload";

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
  const { toast } = useToast();

  useEffect(() => {
    loadMembers();
    loadAgencySettings();
  }, []);

  const loadAgencySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_settings')
        .select('agency_domain, agency_name, agency_logo_url')
        .single();

      if (error) throw error;
      setAgencyDomain(data?.agency_domain || "");
      setAgencyName(data?.agency_name || "");
      setAgencyLogoUrl(data?.agency_logo_url || "");
    } catch (error) {
      console.error('Error loading agency settings:', error);
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
        <p className="text-muted-foreground">Manage your agency configuration and team members.</p>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h3 className="text-lg font-semibold text-foreground mb-6">Agency Configuration</h3>
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
            onUploadComplete={(url) => setAgencyLogoUrl(url)}
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
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">Agency Team Members</h2>
        
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
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        
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
      </Card>
    </div>
  );
}
