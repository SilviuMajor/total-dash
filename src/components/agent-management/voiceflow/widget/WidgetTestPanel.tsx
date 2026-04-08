import { useState, useEffect, useRef, ReactNode } from "react";
import { Button } from "@/components/ui/button";
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
  const [refreshKey, setRefreshKey] = useState(0);

  // Persist panel state in sessionStorage for same agent
  useEffect(() => {
    const saved = sessionStorage.getItem(`widget_panel_${agent.id}`);
    if (saved) setIsPanelOpen(JSON.parse(saved));
  }, [agent.id]);

  useEffect(() => {
    sessionStorage.setItem(`widget_panel_${agent.id}`, JSON.stringify(isPanelOpen));
  }, [isPanelOpen, agent.id]);

  // Listen for settings updates to reload the widget
  useEffect(() => {
    const handleSettingsUpdate = () => setRefreshKey(prev => prev + 1);
    window.addEventListener('widget-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('widget-settings-updated', handleSettingsUpdate);
  }, []);

  const primaryColor = agent.config?.widget_settings?.appearance?.primary_color || '#5B4FFF';
  const fontFamily = agent.config?.widget_settings?.appearance?.font_family || 'Inter';

  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const scriptUrl = `${supabaseUrl}/functions/v1/widget-loader?agentId=${agent.id}&embedded=true&testMode=true`;

  // Build the HTML document that the iframe will render
  const iframeDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%;overflow:hidden;font-family:${fontFamily},system-ui,sans-serif}</style>
</head>
<body>
<script src="${scriptUrl}"><\/script>
</body>
</html>`;

  return (
    <div className="relative min-h-screen">
      {/* Main content wrapper */}
      <div className={`transition-all duration-300 ${isPanelOpen ? 'mr-[403px]' : 'mr-0'}`}>
        {children}
      </div>

      {/* Vertical Tab Button */}
      <div 
        className={`fixed top-1/2 -translate-y-1/2 transition-all duration-300 z-[100] ${
          isPanelOpen ? 'right-[403px]' : 'right-0'
        }`}
      >
        <Button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className="
            text-white hover:opacity-90
            px-4 py-8
            rounded-l-xl rounded-r-none 
            shadow-2xl transition-all duration-300
            hover:px-5
            border-l border-t border-b border-white/20
          "
          style={{ 
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` 
          }}
        >
          <div className="flex items-center justify-center">
            <MessageSquare className="h-7 w-7" />
          </div>
        </Button>
      </div>

      {/* Sliding Panel */}
      <div 
        className={`
          fixed top-0 right-0 h-screen w-[403px] bg-background border-l shadow-2xl 
          transform transition-transform duration-300 z-[90] overflow-hidden
          ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {isPanelOpen && (
          <iframe
            key={refreshKey}
            srcDoc={iframeDoc}
            className="w-full h-full border-0"
            title="Widget Preview"
          />
        )}
      </div>
    </div>
  );
}
