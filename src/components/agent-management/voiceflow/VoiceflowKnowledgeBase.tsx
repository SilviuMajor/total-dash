import { Card } from "@/components/ui/card";

interface VoiceflowKnowledgeBaseProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
}

export function VoiceflowKnowledgeBase({ agent }: VoiceflowKnowledgeBaseProps) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Knowledge Base</h2>
          <p className="text-sm text-muted-foreground">
            Manage your Voiceflow knowledge base and document uploads.
          </p>
        </div>
        <div className="py-12 text-center text-muted-foreground">
          Knowledge Base management coming soon...
        </div>
      </div>
    </Card>
  );
}
