import { Card } from "@/components/ui/card";

interface RetellKnowledgeBaseProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
}

export function RetellKnowledgeBase({ agent }: RetellKnowledgeBaseProps) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Knowledge Base</h2>
          <p className="text-sm text-muted-foreground">
            Manage your Retell AI knowledge base and document uploads.
          </p>
        </div>
        <div className="py-12 text-center text-muted-foreground">
          Knowledge Base management coming soon...
        </div>
      </div>
    </Card>
  );
}
