import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Download, Search, Filter } from "lucide-react";

const recordings = [
  { id: 1, agent: "Sales Agent Pro", duration: "4:32", date: "2025-09-29 14:32", status: "Completed", sentiment: "Positive" },
  { id: 2, agent: "Support Bot Elite", duration: "6:18", date: "2025-09-29 13:45", status: "Handover", sentiment: "Neutral" },
  { id: 3, agent: "Lead Generator", duration: "3:21", date: "2025-09-29 12:15", status: "Completed", sentiment: "Positive" },
  { id: 4, agent: "Customer Care AI", duration: "5:47", date: "2025-09-29 11:30", status: "Completed", sentiment: "Negative" },
  { id: 5, agent: "Sales Agent Pro", duration: "7:12", date: "2025-09-29 10:22", status: "Completed", sentiment: "Positive" },
  { id: 6, agent: "Support Bot Elite", duration: "2:45", date: "2025-09-29 09:15", status: "Completed", sentiment: "Neutral" },
];

export default function Recordings() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Recordings</h1>
        <p className="text-muted-foreground">Browse and analyze your AI agent call recordings.</p>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search recordings..." 
              className="pl-10 bg-muted/50 border-border"
            />
          </div>
          <Button variant="secondary" className="gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
        </div>

        <div className="space-y-3">
          {recordings.map((recording) => (
            <div 
              key={recording.id}
              className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all border border-transparent hover:border-primary/30"
            >
              <Button size="icon" variant="ghost" className="text-primary hover:bg-primary/10">
                <Play className="w-4 h-4 fill-current" />
              </Button>
              
              <div className="flex-1 grid grid-cols-5 gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{recording.agent}</p>
                  <p className="text-xs text-muted-foreground">Agent</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{recording.duration}</p>
                  <p className="text-xs text-muted-foreground">Duration</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{recording.date}</p>
                  <p className="text-xs text-muted-foreground">Date & Time</p>
                </div>
                <div>
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    recording.status === "Completed" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                  }`}>
                    {recording.status}
                  </span>
                </div>
                <div>
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    recording.sentiment === "Positive" ? "bg-success/10 text-success" :
                    recording.sentiment === "Negative" ? "bg-destructive/10 text-destructive" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {recording.sentiment}
                  </span>
                </div>
              </div>

              <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-foreground">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
