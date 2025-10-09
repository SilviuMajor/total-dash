import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DuplicateAgentRequest {
  agentId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify user is admin
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
      user_id: user.id
    });

    if (adminError || !isAdmin) {
      throw new Error('Only admins can duplicate agents');
    }

    const { agentId }: DuplicateAgentRequest = await req.json();

    if (!agentId) {
      throw new Error('Agent ID is required');
    }

    console.log(`Starting duplication of agent: ${agentId}`);

    // Fetch original agent
    const { data: originalAgent, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (fetchError || !originalAgent) {
      console.error('Error fetching agent:', fetchError);
      throw new Error('Agent not found');
    }

    // Generate new agent name with copy suffix
    let newAgentName = `${originalAgent.name} (Copy)`;
    
    // Check if name already exists and increment counter
    const { data: existingAgents } = await supabase
      .from('agents')
      .select('name')
      .like('name', `${originalAgent.name} (Copy%)`);

    if (existingAgents && existingAgents.length > 0) {
      // Find the highest copy number
      let maxCopyNumber = 0;
      existingAgents.forEach((agent: any) => {
        const match = agent.name.match(/\(Copy (\d+)\)$/);
        if (match) {
          maxCopyNumber = Math.max(maxCopyNumber, parseInt(match[1]));
        } else if (agent.name.endsWith('(Copy)')) {
          maxCopyNumber = Math.max(maxCopyNumber, 1);
        }
      });
      
      if (maxCopyNumber > 0) {
        newAgentName = `${originalAgent.name} (Copy ${maxCopyNumber + 1})`;
      }
    }

    // Clean config: remove api_key and project_id
    const cleanedConfig = { ...originalAgent.config };
    if (cleanedConfig.project_id) delete cleanedConfig.project_id;
    if (cleanedConfig.api_key) delete cleanedConfig.api_key;

    // Create new agent
    const { data: newAgent, error: createError } = await supabase
      .from('agents')
      .insert({
        name: newAgentName,
        provider: originalAgent.provider,
        api_key: '', // Empty API key
        config: cleanedConfig,
        status: originalAgent.status,
      })
      .select()
      .single();

    if (createError || !newAgent) {
      console.error('Error creating agent:', createError);
      throw new Error('Failed to create duplicated agent');
    }

    console.log(`Created new agent: ${newAgent.id}`);

    // Duplicate agent_spec_sections
    const { data: specSections, error: specFetchError } = await supabase
      .from('agent_spec_sections')
      .select('*')
      .eq('agent_id', agentId);

    if (specFetchError) {
      console.error('Error fetching spec sections:', specFetchError);
    } else if (specSections && specSections.length > 0) {
      const newSpecSections = specSections.map((section: any) => ({
        agent_id: newAgent.id,
        title: section.title,
        section_type: section.section_type,
        content: section.content,
        sort_order: section.sort_order,
      }));

      const { error: specInsertError } = await supabase
        .from('agent_spec_sections')
        .insert(newSpecSections);

      if (specInsertError) {
        console.error('Error duplicating spec sections:', specInsertError);
      } else {
        console.log(`Duplicated ${newSpecSections.length} spec sections`);
      }
    }

    // Duplicate agent_workflows
    const { data: workflows, error: workflowsFetchError } = await supabase
      .from('agent_workflows')
      .select('*')
      .eq('agent_id', agentId);

    if (workflowsFetchError) {
      console.error('Error fetching workflows:', workflowsFetchError);
    } else if (workflows && workflows.length > 0) {
      const newWorkflows = workflows.map((workflow: any) => ({
        agent_id: newAgent.id,
        name: workflow.name,
        description: workflow.description,
        category: workflow.category,
        sort_order: workflow.sort_order,
      }));

      const { error: workflowsInsertError } = await supabase
        .from('agent_workflows')
        .insert(newWorkflows);

      if (workflowsInsertError) {
        console.error('Error duplicating workflows:', workflowsInsertError);
      } else {
        console.log(`Duplicated ${newWorkflows.length} workflows`);
      }
    }

    // Duplicate agent_workflow_categories
    const { data: categories, error: categoriesFetchError } = await supabase
      .from('agent_workflow_categories')
      .select('*')
      .eq('agent_id', agentId);

    if (categoriesFetchError) {
      console.error('Error fetching workflow categories:', categoriesFetchError);
    } else if (categories && categories.length > 0) {
      const newCategories = categories.map((category: any) => ({
        agent_id: newAgent.id,
        name: category.name,
        color: category.color,
        sort_order: category.sort_order,
      }));

      const { error: categoriesInsertError } = await supabase
        .from('agent_workflow_categories')
        .insert(newCategories);

      if (categoriesInsertError) {
        console.error('Error duplicating workflow categories:', categoriesInsertError);
      } else {
        console.log(`Duplicated ${newCategories.length} workflow categories`);
      }
    }

    // Duplicate agent_integrations
    const { data: integrations, error: integrationsFetchError } = await supabase
      .from('agent_integrations')
      .select('*')
      .eq('agent_id', agentId);

    if (integrationsFetchError) {
      console.error('Error fetching integrations:', integrationsFetchError);
    } else if (integrations && integrations.length > 0) {
      const newIntegrations = integrations.map((integration: any) => ({
        agent_id: newAgent.id,
        integration_id: integration.integration_id,
        sort_order: integration.sort_order,
      }));

      const { error: integrationsInsertError } = await supabase
        .from('agent_integrations')
        .insert(newIntegrations);

      if (integrationsInsertError) {
        console.error('Error duplicating integrations:', integrationsInsertError);
      } else {
        console.log(`Duplicated ${newIntegrations.length} integrations`);
      }
    }

    console.log(`Agent duplication completed successfully: ${newAgent.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        newAgentId: newAgent.id,
        newAgentName: newAgent.name,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in duplicate-agent function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
