import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, Copy, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const DEPARTMENT_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#84cc16', label: 'Lime' },
  { value: '#22c55e', label: 'Green' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#6B7280', label: 'Grey' },
  { value: '#78716c', label: 'Stone' },
];

interface Department {
  id: string;
  client_id: string;
  name: string;
  code: string | null;
  color: string | null;
  description: string | null;
  timeout_seconds: number;
  is_global: boolean;
  fallback_to_global: boolean;
  fallback_out_of_hours: boolean;
  timezone: string;
  opening_hours_type: string;
  opening_hours: any;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Dubai",
  "Australia/Sydney",
];

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

const DEFAULT_ADVANCED_HOURS = Object.fromEntries(
  DAYS.map(day => [day, {
    enabled: ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(day),
    open: "09:00",
    close: "17:00",
  }])
);

function isDepartmentOpen(dept: Department): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: dept.timezone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "long",
    });
    const parts = formatter.formatToParts(now);
    const hour = parts.find(p => p.type === "hour")?.value || "00";
    const minute = parts.find(p => p.type === "minute")?.value || "00";
    const currentTime = `${hour}:${minute}`;
    const dayName = parts.find(p => p.type === "weekday")?.value?.toLowerCase() || "monday";

    if (dept.opening_hours_type === "simple") {
      const hours = dept.opening_hours?.simple;
      if (!hours?.open || !hours?.close) return true;
      return currentTime >= hours.open && currentTime < hours.close;
    } else if (dept.opening_hours_type === "advanced") {
      const dayHours = dept.opening_hours?.advanced?.[dayName];
      if (!dayHours?.enabled) return false;
      return currentTime >= dayHours.open && currentTime < dayHours.close;
    }
    return true;
  } catch {
    return true;
  }
}

function generateCode(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export function DepartmentManagement({ clientId, readOnly }: { clientId: string; readOnly?: boolean }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeAutoGenerated, setCodeAutoGenerated] = useState(true);
  const [color, setColor] = useState("#3b82f6");
  const [description, setDescription] = useState("");
  const [timeoutSecs, setTimeoutSecs] = useState(300);
  const [timezone, setTimezone] = useState("UTC");
  const [openingHoursType, setOpeningHoursType] = useState<"simple" | "advanced">("simple");
  const [simpleOpen, setSimpleOpen] = useState("09:00");
  const [simpleClose, setSimpleClose] = useState("17:00");
  const [advancedHours, setAdvancedHours] = useState(DEFAULT_ADVANCED_HOURS);
  const [fallbackToGlobal, setFallbackToGlobal] = useState(true);
  const [fallbackOutOfHours, setFallbackOutOfHours] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    loadDepartments();
  }, [clientId]);

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("client_id", clientId)
        .is("deleted_at", null)
        .order("is_global", { ascending: false })
        .order("name");

      if (error) throw error;
      setDepartments((data || []) as Department[]);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setCode("");
    setCodeAutoGenerated(true);
    setColor("#3b82f6");
    setDescription("");
    setTimeoutSecs(300);
    setTimezone("UTC");
    setOpeningHoursType("simple");
    setSimpleOpen("09:00");
    setSimpleClose("17:00");
    setAdvancedHours(DEFAULT_ADVANCED_HOURS);
    setFallbackToGlobal(true);
    setFallbackOutOfHours(true);
  };

  const handleOpenDialog = (department?: Department) => {
    if (department) {
      setEditingDepartment(department);
      setName(department.name);
      setCode(department.code || "");
      setCodeAutoGenerated(false);
      setColor(department.color || "#3b82f6");
      setDescription(department.description || "");
      setTimeoutSecs(department.timeout_seconds || 60);
      setTimezone(department.timezone || "UTC");
      const ohType = (department.opening_hours_type as "simple" | "advanced") || "simple";
      setOpeningHoursType(ohType);
      if (ohType === "simple" && department.opening_hours?.simple) {
        setSimpleOpen(department.opening_hours.simple.open || "09:00");
        setSimpleClose(department.opening_hours.simple.close || "17:00");
      }
      if (ohType === "advanced" && department.opening_hours?.advanced) {
        setAdvancedHours({ ...DEFAULT_ADVANCED_HOURS, ...department.opening_hours.advanced });
      }
      setFallbackToGlobal(department.fallback_to_global ?? true);
      setFallbackOutOfHours(department.fallback_out_of_hours ?? true);
    } else {
      setEditingDepartment(null);
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!editingDepartment && codeAutoGenerated) {
      setCode(generateCode(value));
    }
  };

  const handleCodeChange = (value: string) => {
    setCode(value);
    setCodeAutoGenerated(false);
  };

  const buildOpeningHours = () => {
    if (openingHoursType === "simple") {
      return { simple: { open: simpleOpen, close: simpleClose } };
    }
    return { advanced: advancedHours };
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Error", description: "Department name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        color,
        description: description.trim() || null,
        timeout_seconds: timeoutSecs,
        timezone,
        opening_hours_type: openingHoursType,
        opening_hours: buildOpeningHours(),
        fallback_to_global: fallbackToGlobal,
        fallback_out_of_hours: fallbackOutOfHours,
      };

      if (editingDepartment) {
        const { error } = await supabase
          .from("departments")
          .update(payload)
          .eq("id", editingDepartment.id);
        if (error) throw error;
        toast({ title: "Success", description: "Department updated successfully" });
      } else {
        const { error } = await supabase
          .from("departments")
          .insert({ ...payload, client_id: clientId, code: code || generateCode(name), is_global: false });
        if (error) throw error;
        toast({ title: "Success", description: "Department created successfully" });
      }

      setDialogOpen(false);
      loadDepartments();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!departmentToDelete) return;
    try {
      const { error } = await supabase
        .from("departments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", departmentToDelete.id);
      if (error) throw error;
      toast({ title: "Success", description: "Department deleted successfully" });
      loadDepartments();
      setDeleteDialogOpen(false);
      setDepartmentToDelete(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
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
            <p className="text-sm text-muted-foreground">Configure handover routing departments</p>
          </div>
          {!readOnly && (
            <Button onClick={() => handleOpenDialog()} variant="default" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Department
            </Button>
          )}
        </div>

        {departments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No departments created yet.
          </div>
        ) : (
          <div className="space-y-2">
            {departments.map((dept) => {
              const isOpen = isDepartmentOpen(dept);
              return (
                <div
                  key={dept.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors"
                >
                  {/* Left */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="inline-block w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dept.color || "#3b82f6" }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{dept.name}</span>
                        {dept.is_global && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Global</Badge>
                        )}
                      </div>
                      {dept.code && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <code className="text-xs text-muted-foreground font-mono">{dept.code}</code>
                          <button
                            onClick={() => copyCode(dept.code!)}
                            className="p-0.5 rounded hover:bg-muted transition-colors"
                          >
                            {copiedCode === dept.code ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:block">{dept.timeout_seconds || 60}s</span>
                    <span className="text-xs text-muted-foreground hidden md:block">{dept.timezone || "UTC"}</span>
                    <div className="flex items-center gap-1">
                      <span className={cn("w-2 h-2 rounded-full", isOpen ? "bg-green-500" : "bg-red-400")} />
                      <span className="text-xs text-muted-foreground hidden lg:block">{isOpen ? "Open" : "Closed"}</span>
                    </div>
                    {!readOnly && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenDialog(dept)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {!dept.is_global && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setDepartmentToDelete(dept); setDeleteDialogOpen(true); }}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDepartment ? "Edit Department" : "Add Department"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="basic" className="flex-1">Basic</TabsTrigger>
              <TabsTrigger value="hours" className="flex-1">Hours & Timeout</TabsTrigger>
            </TabsList>

            {/* Basic Tab */}
            <TabsContent value="basic" className="space-y-4 pt-2">
              <div>
                <Label htmlFor="dept-name">Department Name <span className="text-destructive">*</span></Label>
                <Input
                  id="dept-name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Sales, Support"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="dept-code">Routing Code</Label>
                <div className="flex items-center gap-2 mt-1">
                  {editingDepartment ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="relative flex-1">
                          <Input
                            id="dept-code"
                            value={code}
                            readOnly
                            className="font-mono text-sm bg-muted cursor-not-allowed pr-8"
                          />
                          <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Code cannot be changed after creation to avoid breaking Voiceflow flows</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Input
                      id="dept-code"
                      value={code}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      placeholder="auto_generated"
                      className="font-mono text-sm"
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Use this code in your Voiceflow flow to route handovers to this department</p>
              </div>

              <div>
                <Label>Colour</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DEPARTMENT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                        color === c.value ? "border-foreground ring-2 ring-foreground/20 scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="dept-description">Description (optional)</Label>
                <Textarea
                  id="dept-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this department"
                  rows={2}
                  className="mt-1"
                />
              </div>

              {!editingDepartment?.is_global && (
                <>
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-sm font-medium">Fallback to Global</p>
                      <p className="text-xs text-muted-foreground">Fall back to Global department if timeout expires</p>
                    </div>
                    <Switch checked={fallbackToGlobal} onCheckedChange={setFallbackToGlobal} />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-sm font-medium">Fallback when closed</p>
                      <p className="text-xs text-muted-foreground">Fall back to Global department outside opening hours</p>
                    </div>
                    <Switch checked={fallbackOutOfHours} onCheckedChange={setFallbackOutOfHours} />
                  </div>
                </>
              )}
            </TabsContent>

            {/* Hours & Timeout Tab */}
            <TabsContent value="hours" className="space-y-5 pt-2">
              <div>
                <Label className="mb-2 block">Handover acceptance timeout (seconds)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={30}
                    value={timeoutSecs}
                    onChange={e => setTimeoutSecs(Math.max(30, parseInt(e.target.value) || 30))}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">seconds (minimum 30)</span>
                </div>
              </div>

              <div>
                <Label htmlFor="dept-timezone">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map(tz => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Opening Hours</Label>
                <RadioGroup
                  value={openingHoursType}
                  onValueChange={(v) => setOpeningHoursType(v as "simple" | "advanced")}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="simple" id="oh-simple" />
                    <Label htmlFor="oh-simple" className="font-normal cursor-pointer">Simple</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="advanced" id="oh-advanced" />
                    <Label htmlFor="oh-advanced" className="font-normal cursor-pointer">Advanced</Label>
                  </div>
                </RadioGroup>
              </div>

              {openingHoursType === "simple" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="oh-open" className="text-xs">Opens at</Label>
                    <input
                      id="oh-open"
                      type="time"
                      value={simpleOpen}
                      onChange={(e) => setSimpleOpen(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <Label htmlFor="oh-close" className="text-xs">Closes at</Label>
                    <input
                      id="oh-close"
                      type="time"
                      value={simpleClose}
                      onChange={(e) => setSimpleClose(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {DAYS.map(day => {
                    const dayHours = advancedHours[day] || { enabled: false, open: "09:00", close: "17:00" };
                    return (
                      <div key={day} className="flex items-center gap-3">
                        <span className="text-xs font-medium w-8 text-muted-foreground">{DAY_LABELS[day]}</span>
                        <Switch
                          checked={dayHours.enabled}
                          onCheckedChange={(checked) => setAdvancedHours(prev => ({
                            ...prev, [day]: { ...prev[day], enabled: checked }
                          }))}
                        />
                        <input
                          type="time"
                          value={dayHours.open}
                          disabled={!dayHours.enabled}
                          onChange={(e) => setAdvancedHours(prev => ({
                            ...prev, [day]: { ...prev[day], open: e.target.value }
                          }))}
                          className={cn(
                            "w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            !dayHours.enabled && "opacity-40 cursor-not-allowed"
                          )}
                        />
                        <span className="text-xs text-muted-foreground">–</span>
                        <input
                          type="time"
                          value={dayHours.close}
                          disabled={!dayHours.enabled}
                          onChange={(e) => setAdvancedHours(prev => ({
                            ...prev, [day]: { ...prev[day], close: e.target.value }
                          }))}
                          className={cn(
                            "w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            !dayHours.enabled && "opacity-40 cursor-not-allowed"
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "Saving..." : editingDepartment ? "Save Changes" : "Create Department"}
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {departmentToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Users assigned to this department will need to be reassigned. This cannot be undone.
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
