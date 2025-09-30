import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Settings() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your dashboard and integration settings.</p>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h3 className="text-lg font-semibold text-foreground mb-6">Integration Settings</h3>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="voiceflow">Voiceflow API Key</Label>
            <Input 
              id="voiceflow"
              type="password" 
              placeholder="Enter your Voiceflow API key"
              className="bg-muted/50 border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="retell">Retell AI API Key</Label>
            <Input 
              id="retell"
              type="password" 
              placeholder="Enter your Retell AI API key"
              className="bg-muted/50 border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook">Webhook URL</Label>
            <Input 
              id="webhook"
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
        <h3 className="text-lg font-semibold text-foreground mb-6">Client Management</h3>
        
        <div className="space-y-4">
          {["Acme Corp", "Tech Solutions", "Global Industries"].map((client, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div>
                <p className="font-medium text-foreground">{client}</p>
                <p className="text-sm text-muted-foreground">8 active agents</p>
              </div>
              <Button variant="outline" size="sm" className="border-border/50">
                Manage
              </Button>
            </div>
          ))}
        </div>

        <Button variant="secondary" className="w-full mt-4">
          Add New Client
        </Button>
      </Card>
    </div>
  );
}
