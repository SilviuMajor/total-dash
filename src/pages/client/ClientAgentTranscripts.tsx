import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { ClientAgentSelector } from "@/components/ClientAgentSelector";
import { NoAgentsAssigned } from "@/components/NoAgentsAssigned";

interface Transcript {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  conversation: {
    caller_phone: string;
  };
}

export default function ClientAgentTranscripts() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyLogoUrl, setAgencyLogoUrl] = useState<string | null>(null);
  const { selectedAgentId, agents } = useClientAgentContext();

  useEffect(() => {
    if (selectedAgentId) {
      loadTranscripts();
    }
  }, [selectedAgentId]);

  useEffect(() => {
    const loadAgencyLogo = async () => {
      const { data } = await supabase
        .from('agency_settings')
        .select('agency_logo_url')
        .single();
      
      if (data?.agency_logo_url) {
        setAgencyLogoUrl(data.agency_logo_url);
      }
    };
    loadAgencyLogo();
  }, []);

  const loadTranscripts = async () => {
    try {
      const { data, error } = await supabase
        .from('transcripts')
        .select(`
          *,
          conversations!inner (
            caller_phone,
            agent_id
          )
        `)
        .eq('conversations.agent_id', selectedAgentId!)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTranscripts(data as any || []);
    } catch (error) {
      console.error('Error loading transcripts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (agents.length === 0) {
    return <NoAgentsAssigned />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Transcripts</h1>
          <p className="text-muted-foreground">View and search conversation transcripts.</p>
        </div>
        <div className="flex items-center gap-4">
          <ClientAgentSelector />
          {agencyLogoUrl && (
            <img 
              src={agencyLogoUrl} 
              alt="Agency logo" 
              className="w-16 h-16 object-contain"
            />
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search transcripts..."
          className="pl-10 bg-muted/50 border-border/50"
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="p-6 bg-gradient-card border-border/50 animate-pulse">
              <div className="h-20 bg-muted rounded"></div>
            </Card>
          ))}
        </div>
      ) : transcripts.length === 0 ? (
        <Card className="p-12 bg-gradient-card border-border/50 text-center">
          <p className="text-muted-foreground">No transcripts found for this agent.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {transcripts.map((transcript) => (
            <Card key={transcript.id} className="p-6 bg-gradient-card border-border/50">
              <div className="flex items-start gap-4">
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  transcript.speaker === 'agent' 
                    ? 'bg-primary/20 text-primary' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {transcript.speaker}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground mb-2">{transcript.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(transcript.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}