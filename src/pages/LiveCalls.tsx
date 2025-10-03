import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, UserCheck, AlertCircle } from "lucide-react";

const liveCalls = [
  { id: 1, agent: "Sales Agent Pro", caller: "+1 (555) 123-4567", duration: "2:14", status: "In Progress" },
  { id: 2, agent: "Support Bot Elite", caller: "+1 (555) 234-5678", duration: "0:42", status: "Handover Requested" },
  { id: 3, agent: "Lead Generator", caller: "+1 (555) 345-6789", duration: "5:33", status: "In Progress" },
];

export default function LiveCalls() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Live Calls</h1>
        <p className="text-muted-foreground">Monitor active calls and handle handover requests in real-time.</p>
      </div>

      <div className="grid gap-6">
        {liveCalls.map((call) => (
          <Card key={call.id} className="p-6 bg-gradient-card border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="w-8 h-8 text-primary" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full animate-pulse" />
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-foreground">{call.agent}</h3>
                    {call.status === "Handover Requested" && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded bg-warning/10 text-warning text-xs font-medium">
                        <AlertCircle className="w-3 h-3" />
                        Handover Requested
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">Caller: {call.caller}</p>
                  <p className="text-xs text-muted-foreground">Duration: {call.duration}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {call.status === "Handover Requested" && (
                  <Button className="bg-foreground text-background hover:bg-foreground/90 gap-2">
                    <UserCheck className="w-4 h-4" />
                    Accept Handover
                  </Button>
                )}
                <Button variant="outline" className="border-border/50">
                  View Details
                </Button>
                <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  End Call
                </Button>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border/50">
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Call Quality</p>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div 
                        key={i}
                        className={`w-2 h-6 rounded-full ${i < 4 ? "bg-success" : "bg-muted"}`}
                      />
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Sentiment</p>
                  <span className="text-sm font-medium text-success">Positive</span>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Intent</p>
                  <span className="text-sm font-medium text-foreground">Product Inquiry</span>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                  <span className="text-sm font-medium text-accent">87%</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {liveCalls.length === 0 && (
        <Card className="p-12 bg-gradient-card border-border/50 text-center">
          <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Active Calls</h3>
          <p className="text-muted-foreground">All agents are currently idle.</p>
        </Card>
      )}
    </div>
  );
}
