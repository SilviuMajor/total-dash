import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DomainsSection } from "./DomainsSection";
import { WorkflowsSection } from "./WorkflowsSection";
import { UpdateLogsSection } from "./UpdateLogsSection";
import { IntegrationsSection } from "./IntegrationsSection";

interface SpecsSettingsProps {
  agent: {
    id: string;
    name: string;
  };
}

export function SpecsSettings({ agent }: SpecsSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [capacity, setCapacity] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [integrations, setIntegrations] = useState<string[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [updateLogs, setUpdateLogs] = useState<any[]>([]);

  useEffect(() => {
    loadSpecs();
  }, [agent.id]);

  const loadSpecs = async () => {
    try {
      // Load capacity and domains
      const { data: specData } = await supabase
        .from('agent_spec_sections')
        .select('*')
        .eq('agent_id', agent.id);

      if (specData) {
        const capacitySection = specData.find(s => s.section_type === 'capacity');
        const domainsSection = specData.find(s => s.section_type === 'domains');
        
        if (capacitySection && typeof capacitySection.content === 'object' && capacitySection.content !== null) {
          setCapacity((capacitySection.content as any)?.value || "");
        }
        if (domainsSection && typeof domainsSection.content === 'object' && domainsSection.content !== null) {
          setDomains((domainsSection.content as any)?.domains || []);
        }
      }

      // Load workflows
      const { data: workflowData } = await supabase
        .from('agent_workflows')
        .select('*')
        .eq('agent_id', agent.id)
        .order('sort_order');

      if (workflowData) setWorkflows(workflowData);

      // Load workflow categories
      const { data: categoryData } = await supabase
        .from('agent_workflow_categories')
        .select('*')
        .eq('agent_id', agent.id)
        .order('sort_order');

      if (categoryData) setCategories(categoryData);

      // Load update logs
      const { data: logsData } = await supabase
        .from('agent_update_logs')
        .select('*')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false });

      if (logsData) setUpdateLogs(logsData);

      // Load integrations
      const { data: integrationsData } = await supabase
        .from('agent_integrations')
        .select('integration_id')
        .eq('agent_id', agent.id);

      if (integrationsData) {
        setIntegrations(integrationsData.map((item: any) => item.integration_id));
      }
    } catch (error) {
      console.error('Error loading specs:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Save capacity
      const { error: capacityError } = await supabase
        .from('agent_spec_sections')
        .upsert({
          agent_id: agent.id,
          section_type: 'capacity',
          title: 'Capacity',
          content: { value: capacity },
        }, {
          onConflict: 'agent_id,section_type'
        });

      if (capacityError) throw capacityError;

      // Save domains
      const { error: domainsError } = await supabase
        .from('agent_spec_sections')
        .upsert({
          agent_id: agent.id,
          section_type: 'domains',
          title: 'Domains',
          content: { domains },
        }, {
          onConflict: 'agent_id,section_type'
        });

      if (domainsError) throw domainsError;

      // Delete existing categories and workflows
      await supabase
        .from('agent_workflow_categories')
        .delete()
        .eq('agent_id', agent.id);

      await supabase
        .from('agent_workflows')
        .delete()
        .eq('agent_id', agent.id);

      // Insert categories
      if (categories.length > 0) {
        const categoriesToInsert = categories.map((cat, idx) => ({
          agent_id: agent.id,
          name: cat.name,
          sort_order: idx,
        }));

        const { data: insertedCategories, error: catError } = await supabase
          .from('agent_workflow_categories')
          .insert(categoriesToInsert)
          .select();

        if (catError) throw catError;

        // Map temp IDs to real IDs
        const categoryIdMap: Record<string, string> = {};
        categories.forEach((cat, idx) => {
          if (insertedCategories?.[idx]) {
            categoryIdMap[cat.id] = insertedCategories[idx].id;
          }
        });

        // Insert workflows with updated category IDs
        if (workflows.length > 0) {
          const workflowsToInsert = workflows.map((workflow, idx) => ({
            agent_id: agent.id,
            name: workflow.name,
            description: workflow.description,
            category: categoryIdMap[workflow.category] || workflow.category,
            sort_order: idx,
          }));

          const { error: workflowError } = await supabase
            .from('agent_workflows')
            .insert(workflowsToInsert);

          if (workflowError) throw workflowError;
        }
      }

      // Handle update logs
      await supabase
        .from('agent_update_logs')
        .delete()
        .eq('agent_id', agent.id);

      if (updateLogs.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const logsToInsert = updateLogs.map(log => ({
          agent_id: agent.id,
          description: log.description,
          created_at: log.created_at,
          created_by: user?.id,
        }));

        const { error: logsError } = await supabase
          .from('agent_update_logs')
          .insert(logsToInsert);

        if (logsError) throw logsError;
      }

      // Handle integrations
      await supabase
        .from('agent_integrations')
        .delete()
        .eq('agent_id', agent.id);

      if (integrations.length > 0) {
        const integrationsToInsert = integrations.map((integrationId, idx) => ({
          agent_id: agent.id,
          integration_id: integrationId,
          sort_order: idx,
        }));

        const { error: integrationsError } = await supabase
          .from('agent_integrations')
          .insert(integrationsToInsert);

        if (integrationsError) throw integrationsError;
      }

      toast({
        title: "Success",
        description: "Agent specifications saved successfully",
      });
      loadSpecs();
    } catch (error) {
      console.error("Error saving specs:", error);
      toast({
        title: "Error",
        description: "Failed to save specifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Agent Specifications</h2>
          <p className="text-sm text-muted-foreground">
            Configure the specifications that clients will see for this agent
          </p>
        </div>

        <div className="space-y-3">
          <Label htmlFor="capacity">Capacity (per month)</Label>
          <Input
            id="capacity"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="e.g., 1000 calls"
          />
        </div>

        <DomainsSection 
          selectedDomains={domains} 
          onDomainsChange={setDomains} 
        />

        <IntegrationsSection
          selectedIntegrations={integrations}
          onIntegrationsChange={setIntegrations}
        />

        <WorkflowsSection
          workflows={workflows}
          categories={categories}
          onWorkflowsChange={setWorkflows}
          onCategoriesChange={setCategories}
        />

        <UpdateLogsSection
          logs={updateLogs}
          onLogsChange={setUpdateLogs}
        />

        <Button onClick={handleSave} disabled={loading} className="w-full">
          {loading ? "Saving..." : "Save Specifications"}
        </Button>
      </div>
    </Card>
  );
}