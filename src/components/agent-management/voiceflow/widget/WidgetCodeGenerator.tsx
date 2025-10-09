import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface WidgetCodeGeneratorProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
}

export function WidgetCodeGenerator({ agent }: WidgetCodeGeneratorProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const widgetSettings = agent.config?.widget_settings || {};
  const apiKey = agent.config?.api_key || '';
  const projectId = agent.config?.project_id || '';

  const embedCode = `<script>
(function() {
  window.VoiceflowWidget = {
    agentId: '${agent.id}',
    apiKey: '${apiKey}',
    projectId: '${projectId}',
    config: ${JSON.stringify(widgetSettings, null, 6).split('\n').join('\n    ')}
  };
  var script = document.createElement('script');
  script.src = 'https://${window.location.hostname}/voiceflow-widget.js';
  script.async = true;
  document.body.appendChild(script);
})();
</script>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Embed code copied to clipboard"
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy code",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Website Deployment</h3>
          <p className="text-sm text-muted-foreground">
            Copy this code and paste it into your website to deploy the chat widget.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Embed Code</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </>
              )}
            </Button>
          </div>

          <div className="relative">
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
              <code>{embedCode}</code>
            </pre>
          </div>
        </div>

        <div className="bg-accent/50 p-4 rounded-lg border border-border">
          <h4 className="text-sm font-semibold mb-2">Installation Instructions</h4>
          <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
            <li>Copy the embed code above using the "Copy to Clipboard" button</li>
            <li>Open your website's HTML file or template</li>
            <li>Paste the code just before the closing <code className="bg-muted px-1 py-0.5 rounded text-xs">&lt;/body&gt;</code> tag</li>
            <li>Save and publish your changes</li>
            <li>The widget will appear automatically on all pages where the code is added</li>
          </ol>
        </div>

        <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Note:</strong> The widget will use the appearance settings configured in the "Appearance & Branding" tab. 
            Any changes you make to those settings will automatically apply to the deployed widget.
          </p>
        </div>
      </div>
    </Card>
  );
}
