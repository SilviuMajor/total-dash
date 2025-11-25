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

  const embedCode = `<script src="${import.meta.env.VITE_SUPABASE_URL}/functions/v1/widget-loader?agentId=${agent.id}" async></script>`;

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
            <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs font-mono border">
              <code className="break-all whitespace-pre-wrap">{embedCode}</code>
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
            <li>The chat button will appear in the bottom-right corner of your website</li>
          </ol>
        </div>

        <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Features:</strong>
          </p>
          <ul className="text-sm space-y-1 mt-2 text-muted-foreground list-disc list-inside">
            <li>Floating chat button with custom icon (or styled default)</li>
            <li>Conversation history preserved across page refreshes</li>
            <li>All branding and appearance settings applied automatically</li>
            <li>Secure: API keys never exposed to the client</li>
            <li>Works on any website without conflicts</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
