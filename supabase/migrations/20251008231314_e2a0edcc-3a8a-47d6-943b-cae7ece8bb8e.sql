-- Add unique constraint for agent_spec_sections to enable upsert
ALTER TABLE agent_spec_sections 
ADD CONSTRAINT agent_spec_sections_agent_section_unique 
UNIQUE (agent_id, section_type);