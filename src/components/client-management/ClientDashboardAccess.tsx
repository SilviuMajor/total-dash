import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";

interface ClientDashboardAccessProps {
  client: {
    id: string;
    name: string;
    custom_domain: string | null;
  };
}

export function ClientDashboardAccess({ client }: ClientDashboardAccessProps) {
  const [copied, setCopied] = useState(false);
  const dashboardUrl = client.custom_domain 
    ? `https://${client.custom_domain}` 
    : `${window.location.origin}/client/${client.id}/dashboard`;

  const handleCopy = () => {
    navigator.clipboard.writeText(dashboardUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-card border-border/50">
        <h3 className="text-lg font-semibold text-foreground mb-4">Dashboard URL</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dashboardUrl">Client Dashboard Link</Label>
            <div className="flex gap-2">
              <Input
                id="dashboardUrl"
                value={dashboardUrl}
                readOnly
                className="bg-muted/50 border-border"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="border-border/50"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Share this link with your client to access their dashboard
            </p>
          </div>

          <div className="pt-4 border-t border-border/50">
            <Button
              onClick={() => window.open(dashboardUrl, '_blank')}
              className="bg-gradient-accent hover:opacity-90 gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open Client Dashboard
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h3 className="text-lg font-semibold text-foreground mb-4">Dashboard Preview</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Preview how the dashboard appears to your client with their branding and assigned agents.
        </p>
        <div className="aspect-video bg-muted/30 rounded-lg border border-border/50 flex items-center justify-center">
          <div className="text-center">
            <ExternalLink className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Click "Open Client Dashboard" to view the full dashboard
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
