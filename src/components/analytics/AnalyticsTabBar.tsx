import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Edit2, Check } from "lucide-react";
import { AnalyticsTab } from "@/hooks/useAnalyticsTabs";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AnalyticsTabBarProps {
  tabs: AnalyticsTab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabCreate: (name: string) => void;
  onTabRename: (tabId: string, name: string) => void;
  onTabDelete: (tabId: string) => void;
  onTabReorder: (tabs: AnalyticsTab[]) => void;
}

export function AnalyticsTabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabCreate,
  onTabRename,
  onTabDelete,
  onTabReorder
}: AnalyticsTabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const [deleteConfirmTabId, setDeleteConfirmTabId] = useState<string | null>(null);
  const [draggedTab, setDraggedTab] = useState<AnalyticsTab | null>(null);

  const startEditing = (tab: AnalyticsTab) => {
    setEditingTabId(tab.id);
    setEditingName(tab.name);
  };

  const finishEditing = () => {
    if (editingTabId && editingName.trim()) {
      onTabRename(editingTabId, editingName.trim());
    }
    setEditingTabId(null);
    setEditingName("");
  };

  const createTab = () => {
    if (newTabName.trim()) {
      onTabCreate(newTabName.trim());
      setNewTabName("");
      setIsCreating(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, tab: AnalyticsTab) => {
    setDraggedTab(tab);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, tab: AnalyticsTab) => {
    e.preventDefault();
    if (!draggedTab || draggedTab.id === tab.id) return;

    const newTabs = [...tabs];
    const draggedIndex = newTabs.findIndex(t => t.id === draggedTab.id);
    const targetIndex = newTabs.findIndex(t => t.id === tab.id);

    newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, draggedTab);

    onTabReorder(newTabs);
  };

  const handleDragEnd = () => {
    setDraggedTab(null);
  };

  return (
    <>
      <div className="flex items-center gap-1 border-b border-border bg-card/50 px-2 overflow-x-auto">
        {tabs.map(tab => (
          <div
            key={tab.id}
            draggable
            onDragStart={(e) => handleDragStart(e, tab)}
            onDragOver={(e) => handleDragOver(e, tab)}
            onDragEnd={handleDragEnd}
            className={cn(
              "group relative flex items-center gap-2 px-4 py-2 rounded-t-lg cursor-pointer transition-all min-w-[120px] max-w-[200px]",
              activeTabId === tab.id
                ? "bg-background border-t border-x border-border"
                : "hover:bg-muted/50"
            )}
            onClick={() => !editingTabId && onTabSelect(tab.id)}
          >
            {editingTabId === tab.id ? (
              <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") finishEditing();
                    if (e.key === "Escape") setEditingTabId(null);
                  }}
                  className="h-6 text-sm"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={finishEditing}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <span className="text-sm font-medium truncate flex-1">{tab.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(tab);
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  {!tab.is_default && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmTabId(tab.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}

        {isCreating ? (
          <div className="flex items-center gap-1 px-4 py-2 min-w-[120px]">
            <Input
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createTab();
                if (e.key === "Escape") setIsCreating(false);
              }}
              placeholder="Tab name"
              className="h-6 text-sm"
              autoFocus
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={createTab}
            >
              <Check className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      <AlertDialog open={!!deleteConfirmTabId} onOpenChange={() => setDeleteConfirmTabId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tab</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tab? All cards within this tab will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmTabId) {
                  onTabDelete(deleteConfirmTabId);
                  setDeleteConfirmTabId(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
