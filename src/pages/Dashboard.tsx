import { MetricCard } from "@/components/MetricCard";
import { Phone, Clock, CheckCircle, Users } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your AI agent overview.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Calls"
          value="1,284"
          change="+12.5% from last month"
          icon={Phone}
          trend="up"
        />
        <MetricCard
          title="Avg Duration"
          value="4:32"
          change="-2.3% from last month"
          icon={Clock}
          trend="down"
        />
        <MetricCard
          title="Success Rate"
          value="94.2%"
          change="+5.1% from last month"
          icon={CheckCircle}
          trend="up"
        />
        <MetricCard
          title="Active Agents"
          value="8"
          change="2 agents online now"
          icon={Users}
          trend="neutral"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 bg-gradient-card border-border/50">
          <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {[
              { agent: "Sales Agent", call: "Inbound call completed", time: "2 min ago", status: "success" },
              { agent: "Support Agent", call: "Handover requested", time: "5 min ago", status: "warning" },
              { agent: "Lead Gen Agent", call: "Call in progress", time: "8 min ago", status: "active" },
              { agent: "Sales Agent", call: "Outbound call completed", time: "12 min ago", status: "success" },
            ].map((activity, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className={`w-2 h-2 rounded-full ${
                  activity.status === "success" ? "bg-success" :
                  activity.status === "warning" ? "bg-warning" :
                  "bg-accent animate-pulse"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{activity.agent}</p>
                  <p className="text-xs text-muted-foreground">{activity.call}</p>
                </div>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card border-border/50">
          <h3 className="text-lg font-semibold text-foreground mb-4">Top Performing Agents</h3>
          <div className="space-y-4">
            {[
              { name: "Sales Agent Pro", calls: 156, success: 96 },
              { name: "Support Bot Elite", calls: 143, success: 94 },
              { name: "Lead Generator", calls: 128, success: 91 },
              { name: "Customer Care AI", calls: 98, success: 89 },
            ].map((agent, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{agent.name}</span>
                  <span className="text-sm text-muted-foreground">{agent.calls} calls</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-accent rounded-full transition-all"
                      style={{ width: `${agent.success}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-success">{agent.success}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
