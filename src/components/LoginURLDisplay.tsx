import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Check, Copy, Link as LinkIcon } from "lucide-react";

interface LoginURLDisplayProps {
  url: string;
  label: string;
  description?: string;
  className?: string;
}

// Read-only login URL display with a Copy button. Used wherever a login URL
// needs to be shown to the user — AgencySettings, AgencyClientDetails,
// client Settings page. Whitelabel awareness lives in the URL passed in
// (built by helpers in src/lib/login-urls.ts), not in this component.
export function LoginURLDisplay({ url, label, description, className }: LoginURLDisplayProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Login URL copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy URL",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className={`p-4 ${className ?? ""}`}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">{label}</Label>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={url}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1.5" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
