import { Card } from "@/components/ui/card";

interface VoiceflowChannelsProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
}

export function VoiceflowChannels({ agent }: VoiceflowChannelsProps) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Channels</h2>
          <p className="text-sm text-muted-foreground">
            Manage communication channels for your Voiceflow agent.
          </p>
        </div>
        <div className="py-12 text-center text-muted-foreground">
          Channel management coming soon...
        </div>
      </div>
    </Card>
  );
}
