import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  provider: string;
}

interface AssignedClient {
  id: string;
  name: string;
}

interface AgentDetailHeaderProps {
  agent: Agent;
  assignedClients: AssignedClient[];
}

export function AgentDetailHeader({ agent, assignedClients }: AgentDetailHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{agent.name}</h1>
          <Badge variant="outline" className="mt-2 capitalize">
            {agent.provider}
          </Badge>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-start gap-3">
          <Building2 className="w-5 h-5 text-muted-foreground mt-1" />
          <div className="flex-1">
            <h3 className="font-medium mb-2">Assigned to Clients</h3>
            {assignedClients.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {assignedClients.map((client) => (
                  <Link key={client.id} to={`/admin/clients/${client.id}`}>
                    <Badge variant="secondary" className="hover:bg-secondary/80 cursor-pointer">
                      {client.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not assigned to any clients</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
