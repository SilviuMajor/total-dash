-- Enable client users to update conversation metadata for their assigned agents
CREATE POLICY "Client users can update conversations for their agents"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  agent_id IN (
    SELECT aa.agent_id
    FROM agent_assignments aa
    WHERE aa.client_id IN (
      SELECT client_id
      FROM get_user_client_ids(auth.uid())
    )
  )
)
WITH CHECK (
  agent_id IN (
    SELECT aa.agent_id
    FROM agent_assignments aa
    WHERE aa.client_id IN (
      SELECT client_id
      FROM get_user_client_ids(auth.uid())
    )
  )
);

-- Also allow admins to update all conversations
CREATE POLICY "Admins can update all conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));