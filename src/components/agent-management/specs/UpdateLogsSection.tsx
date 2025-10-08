import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { format } from "date-fns";

interface UpdateLog {
  id: string;
  description: string;
  created_at: string;
}

interface UpdateLogsSectionProps {
  logs: UpdateLog[];
  onLogsChange: (logs: UpdateLog[]) => void;
}

export function UpdateLogsSection({ logs, onLogsChange }: UpdateLogsSectionProps) {
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [logDescription, setLogDescription] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const addLog = () => {
    if (!logDescription.trim()) return;
    const newLog: UpdateLog = {
      id: `temp_${Date.now()}`,
      description: logDescription,
      created_at: new Date().toISOString(),
    };
    onLogsChange([newLog, ...logs]);
    setLogDescription("");
    setIsAdding(false);
  };

  const updateLog = (logId: string) => {
    onLogsChange(
      logs.map(log => 
        log.id === logId 
          ? { ...log, description: logDescription }
          : log
      )
    );
    setEditingLogId(null);
    setLogDescription("");
  };

  const deleteLog = (logId: string) => {
    onLogsChange(logs.filter(log => log.id !== logId));
  };

  const startEdit = (log: UpdateLog) => {
    setEditingLogId(log.id);
    setLogDescription(log.description);
  };

  const cancelEdit = () => {
    setEditingLogId(null);
    setLogDescription("");
    setIsAdding(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Update History</Label>
        {!isAdding && !editingLogId && (
          <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Update
          </Button>
        )}
      </div>

      {isAdding && (
        <Card className="p-4">
          <div className="space-y-3">
            <Textarea
              placeholder="Describe the update..."
              value={logDescription}
              onChange={(e) => setLogDescription(e.target.value)}
              rows={3}
            />
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={addLog}>
                <Check className="w-4 h-4 mr-1" />
                Add
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {logs.map((log) => (
          <Card key={log.id} className="p-4">
            {editingLogId === log.id ? (
              <div className="space-y-3">
                <Textarea
                  value={logDescription}
                  onChange={(e) => setLogDescription(e.target.value)}
                  rows={3}
                />
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" onClick={() => updateLog(log.id)}>
                    <Check className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm">{log.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(log.created_at), "MMMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => startEdit(log)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteLog(log.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}