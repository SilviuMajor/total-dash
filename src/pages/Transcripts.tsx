import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAgentSelection } from "@/hooks/useAgentSelection";

interface Transcript {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  conversation: {
    caller_phone: string;
    started_at: string;
  };
}

export default function Transcripts() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedAgentId } = useAgentSelection();

  useEffect(() => {
    if (selectedAgentId) {
      loadTranscripts();
    }
  }, [selectedAgentId]);

  const loadTranscripts = async () => {
    try {
      const { data, error } = await supabase
        .from('transcripts')
        .select(`
          id,
          speaker,
          text,
          timestamp,
          conversation:conversations (
            caller_phone,
            started_at
          )
        `)
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Transcripts</h1>
        <p className="text-muted-foreground">Browse conversation transcripts for the selected agent.</p>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search transcripts..." 
              className="pl-10 bg-muted/50 border-border"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : transcripts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No transcripts found for this agent.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transcripts.map((transcript) => (
              <div 
                key={transcript.id}
                className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      transcript.speaker === 'agent' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
                    }`}>
                      {transcript.speaker === 'agent' ? 'Agent' : 'Caller'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(transcript.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-foreground">{transcript.text}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
