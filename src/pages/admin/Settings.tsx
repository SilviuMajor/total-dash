import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminSettings() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Admin Settings</h1>
        <p className="text-muted-foreground">Configure global platform settings and integrations.</p>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h3 className="text-lg font-semibold text-foreground mb-6">Platform Configuration</h3>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="platformName">Platform Name</Label>
            <Input 
              id="platformName"
              type="text" 
              defaultValue="AgentDash"
              className="bg-muted/50 border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supportEmail">Support Email</Label>
            <Input 
              id="supportEmail"
              type="email" 
              placeholder="support@agentdash.com"
              className="bg-muted/50 border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultWebhook">Default Webhook URL</Label>
            <Input 
              id="defaultWebhook"
              type="url" 
              placeholder="https://your-webhook-url.com"
              className="bg-muted/50 border-border"
            />
          </div>

          <Button className="bg-gradient-accent hover:opacity-90">
            Save Settings
          </Button>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h3 className="text-lg font-semibold text-foreground mb-6">API Integrations</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <p className="font-medium text-foreground">Voiceflow API</p>
              <p className="text-sm text-muted-foreground">Manage Voiceflow agent integrations</p>
            </div>
            <span className="text-xs px-2 py-1 rounded bg-success/10 text-success">Active</span>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <p className="font-medium text-foreground">Retell AI API</p>
              <p className="text-sm text-muted-foreground">Manage Retell AI agent integrations</p>
            </div>
            <span className="text-xs px-2 py-1 rounded bg-success/10 text-success">Active</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
