import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Database, Ticket, MessageSquare, Hash, Mail, Calendar, FileText, Folder, Settings, Globe, Phone, Users, Building, Package, ShoppingCart, CreditCard, BarChart, Zap, Cloud, Lock, Key } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Integration {
  id: string;
  name: string;
  icon: string;
  is_custom: boolean;
}

interface IntegrationsSectionProps {
  selectedIntegrations: string[];
  onIntegrationsChange: (integrations: string[]) => void;
}

const iconMap: Record<string, any> = {
  Database, Ticket, MessageSquare, Hash, Mail, Calendar, FileText, Folder, 
  Settings, Globe, Phone, Users, Building, Package, ShoppingCart, CreditCard, 
  BarChart, Zap, Cloud, Lock, Key
};

const iconOptions = [
  "Database", "Ticket", "MessageSquare", "Hash", "Mail", "Calendar", 
  "FileText", "Folder", "Settings", "Globe", "Phone", "Users", 
  "Building", "Package", "ShoppingCart", "CreditCard", "BarChart", 
  "Zap", "Cloud", "Lock", "Key"
];

const gradients = [
  "from-blue-500/20 to-cyan-500/20",
  "from-green-500/20 to-emerald-500/20",
  "from-purple-500/20 to-pink-500/20",
  "from-orange-500/20 to-red-500/20",
  "from-indigo-500/20 to-blue-500/20",
  "from-teal-500/20 to-green-500/20",
  "from-pink-500/20 to-rose-500/20",
  "from-yellow-500/20 to-orange-500/20",
];

export function IntegrationsSection({ selectedIntegrations, onIntegrationsChange }: IntegrationsSectionProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newIntegrationName, setNewIntegrationName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("Database");
  const { toast } = useToast();

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('integration_options')
        .select('*')
        .order('is_custom', { ascending: true })
        .order('name');
      
      if (error) throw error;
      setIntegrations(data || []);
    } catch (error: any) {
      console.error('Error loading integrations:', error);
    }
  };

  const toggleIntegration = (integrationId: string) => {
    if (selectedIntegrations.includes(integrationId)) {
      onIntegrationsChange(selectedIntegrations.filter((id) => id !== integrationId));
    } else {
      onIntegrationsChange([...selectedIntegrations, integrationId]);
    }
  };

  const handleCreateCustomIntegration = async () => {
    if (!newIntegrationName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an integration name",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('integration_options')
        .insert({
          name: newIntegrationName,
          icon: selectedIcon,
          is_custom: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Custom integration created",
      });

      loadIntegrations();
      onIntegrationsChange([...selectedIntegrations, data.id]);
      setNewIntegrationName("");
      setSelectedIcon("Database");
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Integrations</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Custom
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {integrations.map((integration, index) => {
          const Icon = iconMap[integration.icon] || Database;
          const isSelected = selectedIntegrations.includes(integration.id);
          const gradient = gradients[index % gradients.length];

          return (
            <button
              key={integration.id}
              type="button"
              onClick={() => toggleIntegration(integration.id)}
              className={cn(
                "relative flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 bg-gradient-to-br",
                gradient,
                isSelected
                  ? "border-primary shadow-lg scale-105"
                  : "border-border/50 hover:border-primary/50 hover:scale-102"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                isSelected ? "bg-primary/20" : "bg-background/50"
              )}>
                <Icon className={cn(
                  "w-5 h-5 transition-colors",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              <span className={cn(
                "text-sm font-medium transition-colors flex-1 text-left truncate",
                isSelected ? "text-foreground" : "text-muted-foreground"
              )}>
                {integration.name}
              </span>
              {integration.is_custom && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  Custom
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Integration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="integration-name">Integration Name</Label>
              <Input
                id="integration-name"
                value={newIntegrationName}
                onChange={(e) => setNewIntegrationName(e.target.value)}
                placeholder="e.g., Zendesk, HubSpot"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="integration-icon">Icon</Label>
              <Select value={selectedIcon} onValueChange={setSelectedIcon}>
                <SelectTrigger id="integration-icon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {iconOptions.map((iconName) => {
                    const Icon = iconMap[iconName];
                    return (
                      <SelectItem key={iconName} value={iconName}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {iconName}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleCreateCustomIntegration}>
                Create Integration
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}