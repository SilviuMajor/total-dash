import { useState, useEffect, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChatWidget } from "./ChatWidget";
import { MessageSquare } from "lucide-react";

interface WidgetTestPanelProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
  children: ReactNode;
}

export function WidgetTestPanel({ agent, children }: WidgetTestPanelProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Persist panel state in sessionStorage for same agent
  useEffect(() => {
    const saved = sessionStorage.getItem(`widget_panel_${agent.id}`);
    if (saved) setIsPanelOpen(JSON.parse(saved));
  }, [agent.id]);

  useEffect(() => {
    sessionStorage.setItem(`widget_panel_${agent.id}`, JSON.stringify(isPanelOpen));
  }, [isPanelOpen, agent.id]);

  const primaryColor = agent.config?.widget_settings?.appearance?.primary_color || '#5B4FFF';

  return (
    <div className="relative min-h-screen">
      {/* Main content wrapper */}
      <div className={`transition-all duration-300 ${isPanelOpen ? 'mr-[350px]' : 'mr-0'}`}>
        {children}
      </div>

      {/* Vertical Tab Button - Fixed to viewport, always visible */}
      <div 
        className={`fixed top-1/2 -translate-y-1/2 transition-all duration-300 z-[100] ${
          isPanelOpen ? 'right-[350px]' : 'right-0'
        }`}
      >
        <Button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className="
            text-white
            hover:opacity-90
            px-4 py-8
            rounded-l-xl rounded-r-none 
            shadow-2xl
            transition-all duration-300
            hover:px-5
            border-l border-t border-b border-white/20
          "
          style={{ 
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` 
          }}
        >
          <div className="flex flex-col items-center justify-center gap-3" style={{ height: '160px' }}>
            <MessageSquare className="h-6 w-6" />
            <span 
              className="
                text-sm font-semibold tracking-wider uppercase
                [writing-mode:vertical-lr] 
                rotate-180
              "
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Widget Test
            </span>
          </div>
        </Button>
      </div>

      {/* Sliding Panel - Fixed width pushing content */}
      <div 
        className={`
          fixed top-0 right-0 h-screen w-[350px] bg-background border-l shadow-2xl 
          transform transition-transform duration-300 z-[90] overflow-hidden
          ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <ChatWidget 
          agent={agent}
          isTestMode={true}
          onClose={() => setIsPanelOpen(false)}
        />
      </div>
    </div>
  );
}
