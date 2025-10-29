import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ClientLogoUpload } from "./ClientLogoUpload";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";

interface ClientSettingsProps {
  client: {
    id: string;
    name: string;
    logo_url: string | null;
    status: string | null;
    deleted_at: string | null;
    scheduled_deletion_date: string | null;
  };
  onUpdate: () => void;
}

export function ClientSettings({ client, onUpdate }: ClientSettingsProps) {
  const { user, profile, userType } = useMultiTenantAuth();
  const [formData, setFormData] = useState({
    name: client.name,
    logo_url: client.logo_url || "",
    status: client.status || "active",
    slug: "",
  });
  const [originalSlug, setOriginalSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showSlugWarning, setShowSlugWarning] = useState(false);
  const [pendingSlug, setPendingSlug] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [agencyData, setAgencyData] = useState<any>(null);
  const { toast } = useToast();
  
  const isAdmin = profile?.role === 'admin' || userType === 'super_admin';
  const canDelete = isAdmin || userType === 'agency';
  const isDeleting = client.status === 'deleting';

  useEffect(() => {
    // Load current client slug and agency data
    const loadClientData = async () => {
      try {
        const { data: clientData } = await supabase
          .from('clients')
          .select('slug, agency_id')
          .eq('id', client.id)
          .single();

        if (clientData) {
          setFormData(prev => ({ ...prev, slug: clientData.slug }));
          setOriginalSlug(clientData.slug);

          // Load agency data for URL preview
          const { data: agency } = await supabase
            .from('agencies')
            .select('slug, whitelabel_domain, whitelabel_subdomain, whitelabel_verified')
            .eq('id', clientData.agency_id)
            .single();

          if (agency) {
            setAgencyData(agency);
          }
        }
      } catch (error: any) {
        console.error('Error loading client data:', error);
      }
    };

    loadClientData();
  }, [client.id]);

  const handleSlugChange = (newSlug: string) => {
    const normalized = newSlug.toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/^-+|-+$/g, '');
    setPendingSlug(normalized);
    setShowSlugWarning(true);
  };

  const confirmSlugChange = () => {
    setFormData({ ...formData, slug: pendingSlug });
    setShowSlugWarning(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('clients')
        .update(formData)
        .eq('id', client.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client settings updated successfully",
      });

      onUpdate();
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

  const handleSetInactive = async () => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ status: 'inactive' })
        .eq('id', client.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client status changed to inactive",
      });

      setShowDeleteDialog(false);
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!user?.email) return;
    
    setDeleting(true);

    try {
      // Verify admin password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: adminPassword,
      });

      if (authError) {
        toast({
          title: "Invalid password",
          description: "Please enter your correct admin password",
          variant: "destructive",
        });
        setDeleting(false);
        return;
      }

      // Set client to deleting status with 30-day grace period
      const scheduledDeletion = new Date();
      scheduledDeletion.setDate(scheduledDeletion.getDate() + 30);

      const { error } = await supabase
        .from('clients')
        .update({
          status: 'deleting',
          deleted_at: new Date().toISOString(),
          scheduled_deletion_date: scheduledDeletion.toISOString(),
          deleted_by: user.id,
        })
        .eq('id', client.id);

      if (error) throw error;

      toast({
        title: "Client marked for deletion",
        description: "The client will be permanently deleted in 30 days. You can restore it anytime before then.",
      });

      setShowPasswordDialog(false);
      setShowDeleteDialog(false);
      setAdminPassword("");
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async () => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          status: 'active',
          deleted_at: null,
          scheduled_deletion_date: null,
          deleted_by: null,
        })
        .eq('id', client.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client has been restored",
      });

      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {isDeleting && (
        <Card className="p-6 bg-destructive/10 border-destructive/50">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-destructive mb-2">Scheduled for Deletion</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This client is scheduled to be permanently deleted on{" "}
                {client.scheduled_deletion_date 
                  ? new Date(client.scheduled_deletion_date).toLocaleDateString()
                  : "N/A"}
              </p>
              <Button onClick={handleRestore} variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                Restore Client
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6 bg-gradient-card border-border/50">
        <h3 className="text-lg font-semibold text-foreground mb-6">Client Settings</h3>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Client Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Client Name"
              className="bg-muted/50 border-border"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Client Slug (URL Path)</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="client-name"
              className="bg-muted/50 border-border"
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold">Standard URL:</p>
              <p className="font-mono">total-dash.com/{agencyData?.slug || 'agency'}/{formData.slug || 'client'}</p>
              {agencyData?.whitelabel_verified && (
                <>
                  <p className="font-semibold mt-2">Whitelabel URL:</p>
                  <p className="font-mono">
                    {agencyData.whitelabel_subdomain}.{agencyData.whitelabel_domain}/{formData.slug || 'client'}
                  </p>
                </>
              )}
            </div>
          </div>

          <ClientLogoUpload
            currentUrl={formData.logo_url}
            onUploadComplete={async (url) => {
              setFormData({ ...formData, logo_url: url });
              
              // Auto-save logo to database immediately
              try {
                const { error } = await supabase
                  .from('clients')
                  .update({ logo_url: url })
                  .eq('id', client.id);

                if (error) throw error;

                toast({
                  title: "Success",
                  description: "Logo uploaded successfully",
                });

                onUpdate();
              } catch (error: any) {
                toast({
                  title: "Error",
                  description: error.message,
                  variant: "destructive",
                });
              }
            }}
          />

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
              disabled={isDeleting}
            >
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="testing">Testing</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="deleting">Deleting</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={saving || isDeleting}
              className="bg-foreground text-background hover:bg-foreground/90 gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>

            {canDelete && !isDeleting && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Client
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* First confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Client?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>This will permanently delete:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Client account and all settings</li>
                <li>All users associated with this client</li>
                <li>Agent assignments (agents won't be deleted)</li>
                <li>All departments</li>
                <li>Subscription records</li>
              </ul>
              <p className="font-semibold text-destructive">
                ⚠️ This action cannot be undone!
              </p>
              <p className="font-medium">
                Would you rather set the status to 'Inactive' instead?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleSetInactive} variant="secondary">
              Change to Inactive
            </Button>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteDialog(false);
                setShowPasswordDialog(true);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              No, Still Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password confirmation dialog */}
      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              🔐 Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>Enter your admin password to confirm:</p>
              <Input
                type="password"
                placeholder="Admin password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="bg-muted/50 border-border"
              />
              <p className="text-sm">
                The client will be marked for deletion and removed after 30 days.
                You can restore it anytime within 30 days.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAdminPassword("")}>
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleConfirmDelete}
              disabled={!adminPassword || deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Confirm Deletion"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Slug change warning dialog */}
      <AlertDialog open={showSlugWarning} onOpenChange={setShowSlugWarning}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Change Client URL?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Changing the client slug will update all dashboard URLs:
              </p>
              <div className="p-3 bg-muted rounded font-mono text-sm space-y-2">
                <div>
                  <div className="line-through text-muted-foreground">
                    total-dash.com/{agencyData?.slug}/{originalSlug}
                  </div>
                  <div className="text-foreground font-semibold">
                    total-dash.com/{agencyData?.slug}/{pendingSlug}
                  </div>
                </div>
                {agencyData?.whitelabel_verified && (
                  <div className="pt-2 border-t">
                    <div className="line-through text-muted-foreground">
                      {agencyData.whitelabel_subdomain}.{agencyData.whitelabel_domain}/{originalSlug}
                    </div>
                    <div className="text-foreground font-semibold">
                      {agencyData.whitelabel_subdomain}.{agencyData.whitelabel_domain}/{pendingSlug}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-destructive font-semibold">
                ⚠️ This will affect all client user links and bookmarks. Make sure to notify your client users.
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
