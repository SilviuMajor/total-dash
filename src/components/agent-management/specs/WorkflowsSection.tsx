import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Edit2, Check, X } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  color?: string;
}

interface WorkflowsSectionProps {
  workflows: Workflow[];
  categories: WorkflowCategory[];
  onWorkflowsChange: (workflows: Workflow[]) => void;
  onCategoriesChange: (categories: WorkflowCategory[]) => void;
}

const colorOptions = [
  { value: "blue", label: "Blue", class: "from-blue-500 to-cyan-500" },
  { value: "green", label: "Green", class: "from-green-500 to-emerald-500" },
  { value: "purple", label: "Purple", class: "from-purple-500 to-pink-500" },
  { value: "orange", label: "Orange", class: "from-orange-500 to-amber-500" },
  { value: "red", label: "Red", class: "from-red-500 to-rose-500" },
  { value: "indigo", label: "Indigo", class: "from-indigo-500 to-violet-500" },
  { value: "teal", label: "Teal", class: "from-teal-500 to-cyan-500" },
  { value: "pink", label: "Pink", class: "from-pink-500 to-fuchsia-500" },
];

export function WorkflowsSection({ workflows, categories, onWorkflowsChange, onCategoriesChange }: WorkflowsSectionProps) {
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("blue");
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [workflowForm, setWorkflowForm] = useState({ name: "", description: "", category: "" });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCategory: WorkflowCategory = {
      id: `temp_${Date.now()}`,
      name: newCategoryName,
      sort_order: categories.length,
      color: newCategoryColor,
    };
    onCategoriesChange([...categories, newCategory]);
    setNewCategoryName("");
    setNewCategoryColor("blue");
  };

  const updateCategoryColor = (categoryId: string, color: string) => {
    onCategoriesChange(categories.map(c => c.id === categoryId ? { ...c, color } : c));
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

  const handleDragEnd = (event: DragEndEvent, categoryId: string) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const categoryWorkflows = workflows.filter(w => w.category === categoryId);
      const oldIndex = categoryWorkflows.findIndex(w => w.id === active.id);
      const newIndex = categoryWorkflows.findIndex(w => w.id === over.id);
      
      const reorderedCategoryWorkflows = arrayMove(categoryWorkflows, oldIndex, newIndex);
      const otherWorkflows = workflows.filter(w => w.category !== categoryId);
      
      // Update sort_order
      const updatedCategoryWorkflows = reorderedCategoryWorkflows.map((w, idx) => ({
        ...w,
        sort_order: idx,
      }));
      
      onWorkflowsChange([...otherWorkflows, ...updatedCategoryWorkflows]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Workflow Categories</Label>
        <div className="space-y-2">
          {categories.map((category) => {
            const categoryColor = colorOptions.find(c => c.value === category.color) || colorOptions[0];
            return (
              <div key={category.id} className="flex items-center gap-2">
                <div className={`flex-1 p-3 rounded-lg border-2 bg-gradient-to-r ${categoryColor.class} bg-opacity-10`}>
                  <span className="font-semibold text-foreground">{category.name}</span>
                </div>
                <Select value={category.color || "blue"} onValueChange={(color) => updateCategoryColor(category.id, color)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded bg-gradient-to-r ${color.class}`} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteCategory(category.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <Input
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCategory()}
              className="flex-1"
            />
            <Select value={newCategoryColor} onValueChange={setNewCategoryColor}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded bg-gradient-to-r ${color.class}`} />
                      {color.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={addCategory} size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Label>Key Workflows</Label>
        {categories.map((category) => {
          const categoryWorkflows = workflows.filter(w => w.category === category.id);
          const categoryColor = colorOptions.find(c => c.value === category.color) || colorOptions[0];
          return (
            <Card key={category.id} className="p-4 border-2 relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${categoryColor.class}`} />
              <div className="flex items-center justify-between mb-3 pt-1">
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(event, category.id)}
              >
                <SortableContext
                  items={categoryWorkflows.map(w => w.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {categoryWorkflows.map((workflow) => (
                      <SortableWorkflowItem
                        key={workflow.id}
                        workflow={workflow}
                        isEditing={editingWorkflowId === workflow.id}
                        workflowForm={workflowForm}
                        onFormChange={setWorkflowForm}
                        onUpdate={() => updateWorkflow(workflow.id)}
                        onEdit={() => startEditWorkflow(workflow)}
                        onDelete={() => deleteWorkflow(workflow.id)}
                        onCancelEdit={() => setEditingWorkflowId(null)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

interface SortableWorkflowItemProps {
  workflow: Workflow;
  isEditing: boolean;
  workflowForm: { name: string; description: string; category: string };
  onFormChange: (form: { name: string; description: string; category: string }) => void;
  onUpdate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCancelEdit: () => void;
}

function SortableWorkflowItem({ workflow, isEditing, workflowForm, onFormChange, onUpdate, onEdit, onDelete, onCancelEdit }: SortableWorkflowItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workflow.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 rounded-lg border bg-background"
    >
      {isEditing ? (
        <div className="space-y-2">
          <Input
            placeholder="Workflow name"
            value={workflowForm.name}
            onChange={(e) => onFormChange({ ...workflowForm, name: e.target.value })}
          />
          <Textarea
            placeholder="Workflow description"
            value={workflowForm.description}
            onChange={(e) => onFormChange({ ...workflowForm, description: e.target.value })}
            rows={3}
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={onUpdate}>
              <Check className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onCancelEdit}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <button
            className="cursor-grab active:cursor-grabbing mt-1"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex-1">
            <p className="font-medium">{workflow.name || "Untitled Workflow"}</p>
            <p className="text-sm text-muted-foreground mt-1">{workflow.description}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onEdit}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}