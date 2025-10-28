import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus } from "lucide-react";

interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string;
}

export function DepartmentManagement({ clientId }: { clientId: string }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3b82f6");

  const { toast } = useToast();

  useEffect(() => {
    loadDepartments();
  }, [clientId]);

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('client_id', clientId)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
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

  const handleOpenDialog = (department?: Department) => {
    if (department) {
      setEditingDepartment(department);
      setName(department.name);
      setDescription(department.description || "");
      setColor(department.color || "#3b82f6");
    } else {
      setEditingDepartment(null);
      setName("");
      setDescription("");
      setColor("#3b82f6");
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingDepartment) {
        const { error } = await supabase
          .from('departments')
          .update({ name, description, color })
          .eq('id', editingDepartment.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Department updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('departments')
          .insert({ client_id: clientId, name, description, color });

        if (error) throw error;
        toast({
          title: "Success",
          description: "Department created successfully",
        });
      }
      
      setDialogOpen(false);
      loadDepartments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };


  const handleDelete = async () => {
    if (!departmentToDelete) return;

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentToDelete.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Department deleted successfully",
      });
      loadDepartments();
      setDeleteDialogOpen(false);
      setDepartmentToDelete(null);
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
          <div className="h-12 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Departments</h3>
            <p className="text-sm text-muted-foreground">Organize users by department</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="bg-foreground text-background hover:bg-foreground/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Department
          </Button>
        </div>

        {departments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No departments created yet.
          </div>
        ) : (
          <div className="space-y-3">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-medium text-foreground">{dept.name}</p>
                  {dept.description && (
                    <p className="text-sm text-muted-foreground">{dept.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(dept)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setDepartmentToDelete(dept);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? "Edit Department" : "Add Department"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Department Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sales, Support, Engineering"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this department"
              />
            </div>
            <div>
              <Label htmlFor="color">Department Color</Label>
              <Input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 cursor-pointer"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1 bg-foreground text-background hover:bg-foreground/90">
                {editingDepartment ? "Save Changes" : "Create Department"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {departmentToDelete?.name}? Users in this department will be set to "No Department".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
