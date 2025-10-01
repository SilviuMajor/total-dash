import { Card } from "@/components/ui/card";
import { Bot, AlertCircle } from "lucide-react";

export function NoAgentsAssigned() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="p-12 bg-gradient-card border-border/50 max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="bg-muted/50 p-6 rounded-full">
              <Bot className="h-16 w-16 text-muted-foreground" />
            </div>
            <div className="absolute -top-1 -right-1 bg-warning/20 p-2 rounded-full">
              <AlertCircle className="h-6 w-6 text-warning" />
            </div>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-foreground mb-3">
          No Agents Assigned
        </h2>
        
        <p className="text-muted-foreground mb-2">
          You don't have any AI agents assigned to your account yet.
        </p>
        
        <p className="text-sm text-muted-foreground">
          Please contact your administrator to get started.
        </p>
      </Card>
    </div>
  );
}