import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Globe, Phone, Mail, Bell } from "lucide-react";

interface VoiceflowChannelsProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
}

const channels = [
  {
    id: "web-widget",
    name: "Web Widget",
    description: "Embed the chat widget on your website",
    icon: Globe,
    status: "active" as const,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Connect your agent to WhatsApp Business",
    icon: MessageSquare,
    status: "coming_soon" as const,
  },
  {
    id: "sms",
    name: "SMS",
    description: "Enable SMS conversations with your agent",
    icon: Phone,
    status: "coming_soon" as const,
  },
];

const notificationIntegrations = [
  {
    id: "slack",
    name: "Slack",
    description: "Send handover alerts to a Slack channel",
    icon: "💬",
    status: "coming_soon" as const,
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Send handover alerts to a Teams channel",
    icon: "👥",
    status: "coming_soon" as const,
  },
  {
    id: "email",
    name: "Email Alerts",
    description: "Send handover notifications via email",
    icon: "📧",
    status: "coming_soon" as const,
  },
  {
    id: "webhook",
    name: "Custom Webhook",
    description: "Send handover events to any URL endpoint",
    icon: "🔗",
    status: "coming_soon" as const,
  },
];

export function VoiceflowChannels({ agent }: VoiceflowChannelsProps) {
  return (
    <div className="space-y-6">
      {/* Communication Channels */}
      <div>
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Communication Channels</h3>
            <p className="text-sm text-muted-foreground">
              Manage how customers can reach your agent
            </p>
          </div>
          <div className="space-y-3">
            {channels.map(channel => (
              <div key={channel.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                    <channel.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{channel.name}</p>
                    <p className="text-xs text-muted-foreground">{channel.description}</p>
                  </div>
                </div>
                {channel.status === "active" ? (
                  <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/10">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-muted-foreground">
                    Coming Soon
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Notification Integrations */}
      <div>
        <Card className="p-6">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Handover Notifications</h3>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Get notified when handover requests come in. Configure where alerts are sent for this agent.
            </p>
          </div>
          <div className="space-y-3">
            {notificationIntegrations.map(integration => (
              <div key={integration.id} className="flex items-center justify-between p-3 border rounded-lg opacity-60">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-lg">
                    {integration.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{integration.name}</p>
                    <p className="text-xs text-muted-foreground">{integration.description}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-muted-foreground">
                  Coming Soon
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 p-3 bg-muted/50 rounded-lg">
            Webhook integrations will allow you to send real-time handover events to Slack, Teams, email, or any custom endpoint. Each can be configured per department.
          </p>
        </Card>
      </div>
    </div>
  );
}
