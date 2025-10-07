import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { ClientAgentSelector } from "@/components/ClientAgentSelector";
import { NoAgentsAssigned } from "@/components/NoAgentsAssigned";
import { supabase } from "@/integrations/supabase/client";

const callVolumeData = [
  { name: "Mon", calls: 145 },
  { name: "Tue", calls: 198 },
  { name: "Wed", calls: 167 },
  { name: "Thu", calls: 223 },
  { name: "Fri", calls: 251 },
  { name: "Sat", calls: 189 },
  { name: "Sun", calls: 111 },
];

const performanceData = [
  { name: "Week 1", success: 92, handovers: 8 },
  { name: "Week 2", success: 94, handovers: 6 },
  { name: "Week 3", success: 91, handovers: 9 },
  { name: "Week 4", success: 96, handovers: 4 },
];

export default function ClientAgentAnalytics() {
  const { agents } = useClientAgentContext();

  if (agents.length === 0) {
    return <NoAgentsAssigned />;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold text-foreground">Analytics</h1>
        <div className="flex items-center gap-4">
          <p className="text-muted-foreground">Deep dive into your AI agent performance metrics.</p>
          <ClientAgentSelector />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 bg-gradient-card border-border/50">
          <h3 className="text-lg font-semibold text-foreground mb-6">Call Volume (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={callVolumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem"
                }}
              />
              <Line 
                type="monotone" 
                dataKey="calls" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ fill: "hsl(var(--primary))", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 bg-gradient-card border-border/50">
          <h3 className="text-lg font-semibold text-foreground mb-6">Success Rate vs Handovers</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem"
                }}
              />
              <Bar dataKey="success" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} />
              <Bar dataKey="handovers" fill="hsl(var(--warning))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h3 className="text-lg font-semibold text-foreground mb-6">Call Distribution by Time</h3>
        <div className="grid grid-cols-12 gap-2">
          {Array.from({ length: 24 }, (_, i) => {
            const height = Math.random() * 100;
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center h-32">
                  <div 
                    className="w-full bg-foreground rounded-t transition-all hover:opacity-80"
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{i}h</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}