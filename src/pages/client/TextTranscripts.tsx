import { useState, useEffect } from "react";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Download } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface TextTranscript {
  id: string;
  source_conversation_id: string;
  agent_id: string;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  conversation_started_at: string;
  conversation_ended_at: string | null;
  duration: number | null;
  message_count: number;
  captured_variables: Record<string, any>;
  tags: string[];
  note: string | null;
  sentiment: string | null;
  messages: Array<{
    speaker: string;
    text: string;
    timestamp: string;
    buttons?: any;
    metadata?: any;
  }>;
  created_at: string;
}

export default function TextTranscripts() {
  const { selectedAgentId } = useClientAgentContext();
  const { toast } = useToast();
  const [transcripts, setTranscripts] = useState<TextTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("7");
  const [selectedTranscript, setSelectedTranscript] = useState<TextTranscript | null>(null);

  useEffect(() => {
    if (selectedAgentId) {
      fetchTranscripts();
    }
  }, [selectedAgentId, dateFilter]);

  const fetchTranscripts = async () => {
    if (!selectedAgentId) return;

    setLoading(true);
    try {
      let query = supabase
        .from("text_transcripts")
        .select("*")
        .eq("agent_id", selectedAgentId)
        .order("created_at", { ascending: false });

      // Apply date filter
      if (dateFilter !== "all") {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(dateFilter));
        query = query.gte("created_at", daysAgo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setTranscripts((data || []) as TextTranscript[]);
    } catch (error) {
      console.error("Error fetching transcripts:", error);
      toast({
        title: "Error",
        description: "Failed to load transcripts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTranscripts = transcripts.filter((transcript) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      transcript.user_name?.toLowerCase().includes(searchLower) ||
      transcript.user_email?.toLowerCase().includes(searchLower) ||
      transcript.user_phone?.toLowerCase().includes(searchLower)
    );
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const exportTranscript = (transcript: TextTranscript) => {
    const content = `
Transcript Export
=================

User: ${transcript.user_name || "Anonymous"}
Email: ${transcript.user_email || "N/A"}
Phone: ${transcript.user_phone || "N/A"}
Date: ${format(new Date(transcript.conversation_started_at), "PPpp")}
Duration: ${formatDuration(transcript.duration)}
Messages: ${transcript.message_count}

Variables:
${JSON.stringify(transcript.captured_variables, null, 2)}

Conversation:
${transcript.messages.map((msg) => `[${msg.speaker}]: ${msg.text}`).join("\n")}
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${transcript.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!selectedAgentId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Please select an agent to view transcripts</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-1">Transcripts</h1>
          <p className="text-sm text-muted-foreground">
            Read-only records of past conversations
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-border bg-background p-4">
        <div className="max-w-7xl mx-auto flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Transcripts List */}
      <ScrollArea className="flex-1">
        <div className="max-w-7xl mx-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : filteredTranscripts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No transcripts found
            </div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border">
                    <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Messages</th>
                      <th className="px-4 py-3 font-medium">Duration</th>
                      <th className="px-4 py-3 font-medium">Tags</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTranscripts.map((transcript) => (
                      <tr
                        key={transcript.id}
                        className="hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedTranscript(transcript)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {transcript.user_name || "Anonymous"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {transcript.user_email || transcript.user_phone || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {format(new Date(transcript.conversation_started_at), "MMM d, yyyy")}
                        </td>
                        <td className="px-4 py-3 text-sm">{transcript.message_count}</td>
                        <td className="px-4 py-3 text-sm">
                          {formatDuration(transcript.duration)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {transcript.tags?.map((tag, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTranscript(transcript);
                            }}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Detail Dialog */}
      <Dialog open={!!selectedTranscript} onOpenChange={() => setSelectedTranscript(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {selectedTranscript?.user_name || "Anonymous"}
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedTranscript && exportTranscript(selectedTranscript)}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                {selectedTranscript?.user_email || selectedTranscript?.user_phone || "No contact info"}
              </p>
              <p>
                {selectedTranscript &&
                  format(new Date(selectedTranscript.conversation_started_at), "PPpp")}
              </p>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex gap-4">
            {/* Messages */}
            <ScrollArea className="flex-1 border border-border rounded-lg p-4">
              <div className="space-y-4">
                {selectedTranscript?.messages.map((message, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        message.speaker === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {message.speaker === "user" ? "U" : "A"}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1">
                        {message.speaker === "user" ? "User" : "Agent"} •{" "}
                        {format(new Date(message.timestamp), "HH:mm:ss")}
                      </div>
                      <div className="text-sm">{message.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Variables */}
            <div className="w-80 border border-border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Captured Variables</h3>
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {selectedTranscript &&
                  Object.keys(selectedTranscript.captured_variables).length > 0 ? (
                    Object.entries(selectedTranscript.captured_variables).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <div className="font-mono text-xs text-muted-foreground">{key}</div>
                        <div className="font-medium">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No variables captured</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}