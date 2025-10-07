import { Card } from "@/components/ui/card";

interface RetellWidgetProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
}

export function RetellWidget({ agent }: RetellWidgetProps) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Widget Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Configure your Retell AI widget settings and appearance.
          </p>
        </div>
        <div className="py-12 text-center text-muted-foreground">
          Widget configuration coming soon...
        </div>
      </div>
    </Card>
  );
}
