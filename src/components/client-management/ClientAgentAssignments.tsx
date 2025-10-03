import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bot, GripVertical, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Agent {
  id: string;
  name: string;
  provider: string;
  config: any;
}

interface AssignedAgent extends Agent {
  sort_order: number;
  assignment_id: string;
}

function SortableAgentCard({ agent, onRemove }: { agent: AssignedAgent; onRemove: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: agent.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Bot className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-foreground">{agent.name}</p>
        <p className="text-sm text-muted-foreground">{agent.provider}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(agent.assignment_id)}
      >
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );
}

export function ClientAgentAssignments({ clientId }: { clientId: string }) {
  const [assignedAgents, setAssignedAgents] = useState<AssignedAgent[]>([]);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [agentToRemove, setAgentToRemove] = useState<string | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    try {
      // Load assigned agents with their assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('agent_assignments')
        .select(`
          id,
          agent_id,
          sort_order,
          agents (
            id,
            name,
            provider,
            config
          )
        `)
        .eq('client_id', clientId)
        .order('sort_order');

      if (assignmentsError) throw assignmentsError;

      const assigned = (assignmentsData || []).map((assignment: any) => ({
        ...assignment.agents,
        sort_order: assignment.sort_order,
        assignment_id: assignment.id,
      }));

      setAssignedAgents(assigned);

      // Load all agents to find available ones
      const { data: allAgents, error: agentsError } = await supabase
        .from('agents')
        .select('*')
        .order('name');

      if (agentsError) throw agentsError;

      const assignedIds = new Set(assigned.map((a: AssignedAgent) => a.id));
      const available = (allAgents || []).filter((agent: Agent) => !assignedIds.has(agent.id));
      
      setAvailableAgents(available);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = assignedAgents.findIndex((a) => a.id === active.id);
      const newIndex = assignedAgents.findIndex((a) => a.id === over.id);

      const newOrder = arrayMove(assignedAgents, oldIndex, newIndex);
      setAssignedAgents(newOrder);

      try {
        const updates = newOrder.map((agent, index) => ({
          id: agent.assignment_id,
          sort_order: index,
        }));

        for (const update of updates) {
          await supabase
            .from('agent_assignments')
            .update({ sort_order: update.sort_order })
            .eq('id', update.id);
        }

        toast({
          title: "Success",
          description: "Agent order updated",
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        loadData();
      }
    }
  };

  const handleAssignAgent = async (agentId: string) => {
    try {
      const { error } = await supabase
        .from('agent_assignments')
        .insert({
          client_id: clientId,
          agent_id: agentId,
          sort_order: assignedAgents.length,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Agent assigned successfully",
      });
      loadData();
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveAgent = async () => {
    if (!agentToRemove) return;

    try {
      const { error } = await supabase
        .from('agent_assignments')
        .delete()
        .eq('id', agentToRemove);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Agent removed successfully",
      });
      loadData();
      setRemoveDialogOpen(false);
      setAgentToRemove(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-16 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              Assigned Agents
              {assignedAgents.length > 0 && (
                <Badge variant="secondary" className="ml-2">{assignedAgents.length}</Badge>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">Drag to reorder agents</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="bg-foreground text-background hover:bg-foreground/90">
            <Plus className="w-4 h-4 mr-2" />
            Assign Agent
          </Button>
        </div>

        {assignedAgents.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No agents assigned yet</p>
            <Button onClick={() => setDialogOpen(true)} variant="outline">
              Assign Your First Agent
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={assignedAgents.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {assignedAgents.map((agent) => (
                  <SortableAgentCard
                    key={agent.id}
                    agent={agent}
                    onRemove={(id) => {
                      setAgentToRemove(id);
                      setRemoveDialogOpen(true);
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </Card>

      {/* Assign Agent Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {availableAgents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                All agents are already assigned to this client.
              </div>
            ) : (
              availableAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleAssignAgent(agent.id)}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{agent.name}</p>
                    <p className="text-sm text-muted-foreground">{agent.provider}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Assign
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Agent Confirmation */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this agent from the client? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveAgent} className="bg-destructive hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
