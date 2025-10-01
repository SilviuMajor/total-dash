-- Add sort_order column to agent_assignments for prioritizing agents
ALTER TABLE public.agent_assignments 
ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Create index for efficient sorting
CREATE INDEX idx_agent_assignments_sort_order 
ON public.agent_assignments(client_id, sort_order);

-- Update existing assignments to have sequential sort orders
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY created_at) as rn
  FROM public.agent_assignments
)
UPDATE public.agent_assignments aa
SET sort_order = numbered.rn
FROM numbered
WHERE aa.id = numbered.id;