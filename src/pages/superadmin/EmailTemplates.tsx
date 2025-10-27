import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Edit, Send } from "lucide-react";

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (editingTemplate) {
      setSubject(editingTemplate.subject);
      setHtmlContent(editingTemplate.html_content);
      generatePreview(editingTemplate.html_content, editingTemplate.variables);
    }
  }, [editingTemplate]);

  useEffect(() => {
    if (editingTemplate) {
      generatePreview(htmlContent, editingTemplate.variables);
    }
  }, [htmlContent]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      toast.error("Failed to load templates: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePreview = (html: string, variables: any[]) => {
    let preview = html;
    // Replace variables with sample data
    const sampleData: any = {
      userName: "John Doe",
      agencyName: "Acme Agency",
      trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      planName: "Starter Plan",
      monthlyPrice: "$49.00",
      daysRemaining: "3",
      loginUrl: "#",
      manageSubscriptionUrl: "#",
      cancelUrl: "#",
      supportEmail: "support@example.com",
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      invoiceUrl: "#",
      maxClients: "10",
      maxAgents: "25",
      maxTeamMembers: "5",
      dashboardUrl: "#",
      accessEndsDate: new Date().toLocaleDateString(),
      resubscribeUrl: "#",
      gracePeriodDays: "3",
      updatePaymentUrl: "#",
    };

    for (const [key, value] of Object.entries(sampleData)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      preview = preview.replace(regex, String(value));
    }

    setPreviewHtml(preview);
  };

  const handleSave = async () => {
    if (!editingTemplate) return;

    try {
      const { error } = await supabase
        .from("email_templates")
        .update({
          subject,
          html_content: htmlContent,
        })
        .eq("id", editingTemplate.id);

      if (error) throw error;

      toast.success("Template updated successfully");
      setEditingTemplate(null);
      loadTemplates();
    } catch (error: any) {
      toast.error("Failed to update template: " + error.message);
    }
  };

  const handleTestEmail = async () => {
    if (!editingTemplate) return;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.email) {
        toast.error("Could not find your email address");
        return;
      }

      // Use sample data for test
      const sampleVariables: any = {
        userName: "Test User",
        agencyName: "Test Agency",
        trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        planName: "Starter Plan",
        monthlyPrice: "$49.00",
        daysRemaining: "3",
        loginUrl: window.location.origin,
        manageSubscriptionUrl: window.location.origin,
        cancelUrl: window.location.origin,
        supportEmail: "support@example.com",
      };

      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          templateKey: editingTemplate.template_key,
          recipientEmail: profile.email,
          variables: sampleVariables,
        },
      });

      if (error) throw error;

      toast.success(`Test email sent to ${profile.email}`);
    } catch (error: any) {
      toast.error("Failed to send test email: " + error.message);
    }
  };

  const templatesByCategory = templates.reduce((acc, template) => {
    if (!acc[template.category]) acc[template.category] = [];
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, any[]>);

  if (loading) {
    return <div className="p-8">Loading templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Email Templates</h1>
        <p className="text-muted-foreground">Manage system email templates</p>
      </div>

      <Tabs defaultValue="trial">
        <TabsList>
          <TabsTrigger value="trial">Trial Lifecycle</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
          <TabsContent key={category} value={category} className="space-y-4">
            {categoryTemplates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <CardTitle>{template.name}</CardTitle>
                        <Badge variant={template.is_active ? "default" : "secondary"}>
                          {template.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <CardDescription>{template.description}</CardDescription>
                      <p className="text-sm text-muted-foreground">
                        <strong>Subject:</strong> {template.subject}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTemplate(template)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-6xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit: {editingTemplate?.name}</DialogTitle>
            <DialogDescription>{editingTemplate?.description}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 flex-1 overflow-hidden">
            <div className="space-y-4 overflow-y-auto pr-2">
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>

              <div className="space-y-2">
                <Label>HTML Content</Label>
                <Textarea
                  className="font-mono text-xs min-h-[400px]"
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  placeholder="HTML content with {{variables}}"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave}>Save Changes</Button>
                <Button variant="outline" onClick={handleTestEmail}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Email
                </Button>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto">
              <div>
                <Label>Available Variables</Label>
                <div className="text-xs text-muted-foreground space-y-1 mt-2 bg-muted p-3 rounded-lg">
                  {Array.isArray(editingTemplate?.variables) && editingTemplate.variables.map((v: any, i: number) => (
                    <div key={i}>
                      <code className="bg-background px-1 py-0.5 rounded text-xs">
                        {`{{${v.name}}}`}
                      </code>
                      <span className="ml-2">{v.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <Label>Preview</Label>
                <div
                  className="border rounded-lg p-4 mt-2 bg-white text-black overflow-auto max-h-[500px]"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
