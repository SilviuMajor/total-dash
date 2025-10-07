import { Card } from "@/components/ui/card";

interface RetellChannelsProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
}

export function RetellChannels({ agent }: RetellChannelsProps) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Channels</h2>
          <p className="text-sm text-muted-foreground">
            Manage communication channels for your Retell AI agent.
          </p>
        </div>
        <div className="py-12 text-center text-muted-foreground">
          Channel management coming soon...
        </div>
      </div>
    </Card>
  );
}
