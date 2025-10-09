import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChatWidget } from "./ChatWidget";
import { MessageSquare } from "lucide-react";

interface WidgetTestPanelProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
}

export function WidgetTestPanel({ agent }: WidgetTestPanelProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  return (
    <>
      {/* Toggle Button - Fixed on Right Edge */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50">
        <Button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-6 rounded-l-lg rounded-r-none shadow-lg"
        >
          <div className="flex flex-col items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <span className="text-xs font-medium [writing-mode:vertical-lr] rotate-180">
              Widget Test
            </span>
          </div>
        </Button>
      </div>

      {/* Sliding Panel with Chat Widget */}
      {isPanelOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-40"
          onClick={() => setIsPanelOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ChatWidget 
              agent={agent}
              isTestMode={true}
              onClose={() => setIsPanelOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
