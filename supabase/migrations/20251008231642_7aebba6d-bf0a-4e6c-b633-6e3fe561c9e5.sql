-- Add color column to agent_workflow_categories
ALTER TABLE agent_workflow_categories 
ADD COLUMN color text DEFAULT 'blue';