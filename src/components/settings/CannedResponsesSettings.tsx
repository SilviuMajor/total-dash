import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { Plus, Trash2, Edit2, Check, X, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CannedResponse {
  id: string;
  agent_id: string | null;
  user_id: string | null;
  category: string;
  title: string;
  body: string;
  sort_order: number;
}

export function CannedResponsesSettings() {
  const { toast } = useToast();
  const { agents, selectedAgentId, clientId } = useClientAgentContext();
  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [personalEnabled, setPersonalEnabled] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // New response form
  const [showAdd, setShowAdd] = useState(false);
  const [newCategory, setNewCategory] = useState("General");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editCategory, setEditCategory] = useState("");

  useEffect(() => {
    if (clientId) {
      loadResponses();
    }
  }, [clientId]);

  useEffect(() => {
    if (selectedAgentId) {
      loadSettings();
    }
  }, [selectedAgentId]);

  const loadSettings = async () => {
    if (!selectedAgent) return;
    const config = selectedAgent as any;
    setPersonalEnabled(config?.config?.canned_responses_personal_enabled !== false);
  };

  const loadResponses = async () => {
    if (!clientId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("canned_responses")
      .select("*")
      .eq("client_id", clientId)
      .order("category")
      .order("sort_order");
    if (!error) setResponses(data || []);
    setLoading(false);
  };

  const togglePersonal = async (enabled: boolean) => {
    setPersonalEnabled(enabled);
    if (!selectedAgentId) return;
    // Get current config
    const { data: agent } = await supabase.from("agents").select("config").eq("id", selectedAgentId).single();
    const currentConfig = (agent?.config as Record<string, any>) || {};
    await supabase.from("agents").update({
      config: { ...currentConfig, canned_responses_personal_enabled: enabled }
    }).eq("id", selectedAgentId);
    toast({ title: "Updated", description: `Personal canned responses ${enabled ? "enabled" : "disabled"}` });
  };

  const addResponse = async () => {
    if (!newTitle.trim() || !newBody.trim() || !clientId) return;
    const { error } = await supabase.from("canned_responses").insert({
      client_id: clientId,
      category: newCategory.trim() || "General",
      title: newTitle.trim(),
      body: newBody.trim(),
      sort_order: responses.length,
    });
    if (error) {
      toast({ title: "Error", description: "Failed to add response", variant: "destructive" });
    } else {
      toast({ title: "Added", description: "Canned response created" });
      setNewTitle(""); setNewBody(""); setShowAdd(false);
      loadResponses();
    }
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase.from("canned_responses").update({
      title: editTitle.trim(),
      body: editBody.trim(),
      category: editCategory.trim() || "General",
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (!error) {
      setEditingId(null);
      loadResponses();
      toast({ title: "Saved" });
    }
  };

  const deleteResponse = async (id: string) => {
    await supabase.from("canned_responses").delete().eq("id", id);
    setDeleteId(null);
    loadResponses();
    toast({ title: "Deleted" });
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // Group by category
  const categories = [...new Set(responses.map(r => r.category))].sort();
  const existingCategories = categories.length > 0 ? categories : ["General"];

  if (!selectedAgentId) return <div className="text-sm text-muted-foreground">Select an agent first.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Canned Responses</h3>
        <p className="text-sm text-muted-foreground">Pre-configured message templates agents can use during handovers.</p>
      </div>

      {/* Personal toggle */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Personal Canned Responses</div>
            <p className="text-xs text-muted-foreground">Allow agents to create their own personal responses</p>
          </div>
          <Switch checked={personalEnabled} onCheckedChange={togglePersonal} />
        </div>
      </Card>

      {/* Variable info */}
      <Card className="p-4 bg-muted/30">
        <div className="text-sm font-medium mb-2">Available Variables</div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{"{{agent_name}}"} — Name of the agent sending the message</p>
          <p className="text-xs text-muted-foreground">{"{{department}}"} — Current department name</p>
        </div>
      </Card>

      {/* Org responses by category */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Organisation Responses</div>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add Response
          </Button>
        </div>

        {/* Add form */}
        {showAdd && (
          <Card className="p-4 space-y-3 border-primary/30">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Category</Label>
                <Input
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  placeholder="e.g. Greetings"
                  list="existing-categories"
                />
                <datalist id="existing-categories">
                  {existingCategories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Welcome message" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Message body</Label>
              <Textarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder='Hi! My name is {{agent_name}} from {{department}}. How can I help?' className="min-h-[80px]" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addResponse} disabled={!newTitle.trim() || !newBody.trim()}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground py-4">Loading...</div>
        ) : categories.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No canned responses yet. Click "Add Response" to create one.
          </Card>
        ) : (
          categories.map(cat => (
            <Card key={cat} className="overflow-hidden">
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors"
              >
                {expandedCategories.has(cat) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{cat}</span>
                <span className="text-xs text-muted-foreground">({responses.filter(r => r.category === cat).length})</span>
              </button>
              {expandedCategories.has(cat) && (
                <div className="border-t">
                  {responses.filter(r => r.category === cat).map(resp => (
                    <div key={resp.id} className="p-3 border-b last:border-b-0 hover:bg-muted/30">
                      {editingId === resp.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Input value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="Category" />
                            <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title" />
                          </div>
                          <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} className="min-h-[60px]" />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEdit(resp.id)}><Check className="h-3 w-3 mr-1" /> Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3 w-3 mr-1" /> Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{resp.title}</div>
                            <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{resp.body}</div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                              setEditingId(resp.id);
                              setEditTitle(resp.title);
                              setEditBody(resp.body);
                              setEditCategory(resp.category);
                            }}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteId(resp.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Response</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteResponse(deleteId)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
