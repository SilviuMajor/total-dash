import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Edit2, Check, X } from "lucide-react";

interface Workflow {
  id: string;
  name: string;
  description: string;
  category: string;
  sort_order: number;
}

interface WorkflowCategory {
  id: string;
  name: string;
  sort_order: number;
}

interface WorkflowsSectionProps {
  workflows: Workflow[];
  categories: WorkflowCategory[];
  onWorkflowsChange: (workflows: Workflow[]) => void;
  onCategoriesChange: (categories: WorkflowCategory[]) => void;
}

export function WorkflowsSection({ workflows, categories, onWorkflowsChange, onCategoriesChange }: WorkflowsSectionProps) {
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [workflowForm, setWorkflowForm] = useState({ name: "", description: "", category: "" });

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCategory: WorkflowCategory = {
      id: `temp_${Date.now()}`,
      name: newCategoryName,
      sort_order: categories.length,
    };
    onCategoriesChange([...categories, newCategory]);
    setNewCategoryName("");
  };

  const deleteCategory = (categoryId: string) => {
    onCategoriesChange(categories.filter(c => c.id !== categoryId));
    onWorkflowsChange(workflows.filter(w => w.category !== categoryId));
  };

  const addWorkflow = (categoryId: string) => {
    const newWorkflow: Workflow = {
      id: `temp_${Date.now()}`,
      name: "",
      description: "",
      category: categoryId,
      sort_order: workflows.filter(w => w.category === categoryId).length,
    };
    onWorkflowsChange([...workflows, newWorkflow]);
    setEditingWorkflowId(newWorkflow.id);
    setWorkflowForm({ name: "", description: "", category: categoryId });
  };

  const updateWorkflow = (workflowId: string) => {
    onWorkflowsChange(
      workflows.map(w => 
        w.id === workflowId 
          ? { ...w, name: workflowForm.name, description: workflowForm.description, category: workflowForm.category }
          : w
      )
    );
    setEditingWorkflowId(null);
    setWorkflowForm({ name: "", description: "", category: "" });
  };

  const deleteWorkflow = (workflowId: string) => {
    onWorkflowsChange(workflows.filter(w => w.id !== workflowId));
  };

  const startEditWorkflow = (workflow: Workflow) => {
    setEditingWorkflowId(workflow.id);
    setWorkflowForm({ name: workflow.name, description: workflow.description, category: workflow.category });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Workflow Categories</Label>
        <div className="space-y-2">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center gap-2">
              <div className="flex-1 p-2 rounded-lg border bg-muted/50">
                <span className="font-medium">{category.name}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => deleteCategory(category.id)}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCategory()}
            />
            <Button type="button" onClick={addCategory} size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Label>Key Workflows</Label>
        {categories.map((category) => (
          <Card key={category.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">{category.name}</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addWorkflow(category.id)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Workflow
              </Button>
            </div>
            <div className="space-y-3">
              {workflows
                .filter(w => w.category === category.id)
                .map((workflow) => (
                  <div key={workflow.id} className="p-3 rounded-lg border bg-background">
                    {editingWorkflowId === workflow.id ? (
                      <div className="space-y-2">
                        <Input
                          placeholder="Workflow name"
                          value={workflowForm.name}
                          onChange={(e) => setWorkflowForm({ ...workflowForm, name: e.target.value })}
                        />
                        <Textarea
                          placeholder="Workflow description"
                          value={workflowForm.description}
                          onChange={(e) => setWorkflowForm({ ...workflowForm, description: e.target.value })}
                          rows={3}
                        />
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" onClick={() => updateWorkflow(workflow.id)}>
                            <Check className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingWorkflowId(null)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{workflow.name || "Untitled Workflow"}</p>
                            <p className="text-sm text-muted-foreground mt-1">{workflow.description}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => startEditWorkflow(workflow)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteWorkflow(workflow.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}