import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    console.log("Handover action request:", action);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let result: any = null;

    switch (action) {
      case "accept_handover":
        result = await handleAcceptHandover(supabaseClient, body);
        break;
      case "take_over":
        result = await handleTakeOver(supabaseClient, body);
        break;
      case "end_handover":
        result = await handleEndHandover(supabaseClient, body);
        break;
      case "transfer":
        result = await handleTransfer(supabaseClient, body);
        break;
      case "accept_transfer":
        result = await handleAcceptTransfer(supabaseClient, body);
        break;
      case "send_message":
        result = await handleSendMessage(supabaseClient, body);
        break;
      case "mark_resolved":
        result = await handleMarkResolved(supabaseClient, body);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in handover-actions:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});

// =============================================
// ACTION: accept_handover
// Client user accepts a pending handover request
// =============================================
async function handleAcceptHandover(
  supabaseClient: any,
  body: {
    conversationId: string;
    clientUserId: string;
    clientUserName: string;
  }
) {
  const { conversationId, clientUserId, clientUserName } = body;
  console.log("Accepting handover:", { conversationId, clientUserId });

  // Atomically claim the pending session (prevents double-accept)
  const { data: session, error: sessionError } = await supabaseClient
    .from("handover_sessions")
    .update({
      status: "active",
      client_user_id: clientUserId,
      accepted_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversationId)
    .eq("status", "pending")
    .select()
    .single();

  if (sessionError || !session) {
    console.error("Failed to accept handover:", sessionError);
    throw new Error(
      "Handover could not be accepted. It may have already been accepted by someone else or timed out."
    );
  }

  // Update conversation status and owner
  await supabaseClient
    .from("conversations")
    .update({
      status: "in_handover",
      owner_id: clientUserId,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  // Log status change
  await supabaseClient.from("conversation_status_history").insert({
    conversation_id: conversationId,
    from_status: "with_ai",
    to_status: "in_handover",
    changed_by_type: "client_user",
    changed_by_id: clientUserId,
  });

  // Get handover messages config
  const { data: conv } = await supabaseClient
    .from("conversations")
    .select("agent_id")
    .eq("id", conversationId)
    .single();

  let joinedMessage = `Now speaking with ${clientUserName}`;
  if (conv?.agent_id) {
    const { data: agent } = await supabaseClient
      .from("agents")
      .select("config")
      .eq("id", conv.agent_id)
      .single();

    const template =
      agent?.config?.handover_messages?.agent_joined_message ||
      "Now speaking with {CLIENT_USER_NAME}";
    joinedMessage = template.replace("{CLIENT_USER_NAME}", clientUserName);
  }

  // Store system message
  await supabaseClient.from("transcripts").insert({
    conversation_id: conversationId,
    speaker: "system",
    text: joinedMessage,
    metadata: {
      type: "handover_accepted",
      client_user_id: clientUserId,
      client_user_name: clientUserName,
      timestamp: new Date().toISOString(),
    },
  });

  // Mark conversation as read for this user
  await supabaseClient
    .from("conversation_read_status")
    .upsert(
      {
        conversation_id: conversationId,
        client_user_id: clientUserId,
        is_read: true,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id,client_user_id" }
    );

  return { session };
}

// =============================================
// ACTION: take_over
// Proactive takeover — no pending request exists
// =============================================
async function handleTakeOver(
  supabaseClient: any,
  body: {
    conversationId: string;
    clientUserId: string;
    clientUserName: string;
  }
) {
  const { conversationId, clientUserId, clientUserName } = body;
  console.log("Proactive takeover:", { conversationId, clientUserId });

  // Get conversation details
  const { data: conv, error: convError } = await supabaseClient
    .from("conversations")
    .select("id, status, agent_id, voiceflow_user_id, department_id")
    .eq("id", conversationId)
    .single();

  if (convError || !conv) {
    throw new Error("Conversation not found");
  }

  if (conv.status === "in_handover") {
    throw new Error("Conversation is already in handover");
  }

  // Complete any existing pending sessions for this conversation
  // (e.g., if a proactive takeover happens while a handover request is pending)
  await supabaseClient
    .from("handover_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completion_method: "handback",
    })
    .eq("conversation_id", conversationId)
    .in("status", ["pending", "active"]);

  // Get the client_id to find the global department
  const { data: assignment } = await supabaseClient
    .from("agent_assignments")
    .select("client_id")
    .eq("agent_id", conv.agent_id)
    .limit(1)
    .single();

  let departmentId = conv.department_id;
  if (!departmentId && assignment?.client_id) {
    // Default to global department
    const { data: globalDept } = await supabaseClient
      .from("departments")
      .select("id")
      .eq("client_id", assignment.client_id)
      .eq("is_global", true)
      .is("deleted_at", null)
      .single();
    departmentId = globalDept?.id;
  }

  // Create a handover session directly as active
  const { data: session, error: sessionError } = await supabaseClient
    .from("handover_sessions")
    .insert({
      conversation_id: conversationId,
      voiceflow_user_id: conv.voiceflow_user_id || "unknown",
      department_id: departmentId,
      original_department_id: departmentId,
      client_user_id: clientUserId,
      takeover_type: "proactive",
      status: "active",
      timeout_duration: 0,
      requested_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (sessionError) {
    console.error("Failed to create takeover session:", sessionError);
    throw new Error("Failed to take over conversation");
  }

  // Update conversation
  await supabaseClient
    .from("conversations")
    .update({
      status: "in_handover",
      owner_id: clientUserId,
      department_id: departmentId,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  // Log status change
  await supabaseClient.from("conversation_status_history").insert({
    conversation_id: conversationId,
    from_status: conv.status,
    to_status: "in_handover",
    changed_by_type: "client_user",
    changed_by_id: clientUserId,
  });

  // Get agent config for message template
  let joinedMessage = `Now speaking with ${clientUserName}`;
  const { data: agent } = await supabaseClient
    .from("agents")
    .select("config")
    .eq("id", conv.agent_id)
    .single();

  if (agent?.config?.handover_messages?.agent_joined_message) {
    joinedMessage = agent.config.handover_messages.agent_joined_message.replace(
      "{CLIENT_USER_NAME}",
      clientUserName
    );
  }

  // Store system message
  await supabaseClient.from("transcripts").insert({
    conversation_id: conversationId,
    speaker: "system",
    text: joinedMessage,
    metadata: {
      type: "handover_accepted",
      client_user_id: clientUserId,
      client_user_name: clientUserName,
      takeover_type: "proactive",
      timestamp: new Date().toISOString(),
    },
  });

  return { session };
}

// =============================================
// ACTION: end_handover
// Client user ends the active handover
// =============================================
async function handleEndHandover(
  supabaseClient: any,
  body: {
    conversationId: string;
    clientUserId: string;
    clientUserName: string;
    resolve: boolean; // true = End & Resolve, false = End — Aftercare
  }
) {
  const { conversationId, clientUserId, clientUserName, resolve } = body;
  const newStatus = resolve ? "resolved" : "aftercare";
  console.log("Ending handover:", { conversationId, resolve, newStatus });

  // Get the active session
  const { data: session, error: sessionError } = await supabaseClient
    .from("handover_sessions")
    .select("*, conversations(agent_id, voiceflow_user_id)")
    .eq("conversation_id", conversationId)
    .eq("status", "active")
    .single();

  if (sessionError || !session) {
    throw new Error("No active handover session found");
  }

  const agentId = session.conversations?.agent_id;
  const voiceflowUserId = session.voiceflow_user_id;

  // Complete the session
  await supabaseClient
    .from("handover_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completion_method: "handback",
    })
    .eq("id", session.id);

  // Update conversation status
  await supabaseClient
    .from("conversations")
    .update({
      status: newStatus,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  // Log status change
  await supabaseClient.from("conversation_status_history").insert({
    conversation_id: conversationId,
    from_status: "in_handover",
    to_status: newStatus,
    changed_by_type: "client_user",
    changed_by_id: clientUserId,
  });

  // Store handover ended system message
  await supabaseClient.from("transcripts").insert({
    conversation_id: conversationId,
    speaker: "system",
    text: "Handover ended",
    metadata: {
      type: "handover_ended",
      resolved: resolve,
      client_user_id: clientUserId,
      timestamp: new Date().toISOString(),
    },
  });

  // Get the department name for Voiceflow variables
  let departmentName = "Support";
  if (session.department_id) {
    const { data: dept } = await supabaseClient
      .from("departments")
      .select("name")
      .eq("id", session.department_id)
      .single();
    if (dept) departmentName = dept.name;
  }

  // Resume Voiceflow — PATCH variables then send success action
  if (agentId && voiceflowUserId) {
    const { data: agent } = await supabaseClient
      .from("agents")
      .select("config")
      .eq("id", agentId)
      .single();

    const apiKey = agent?.config?.api_key;

    if (apiKey) {
      // Step 1: PATCH variables
      try {
        await fetch(
          `https://general-runtime.voiceflow.com/state/user/${voiceflowUserId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              variables: {
                handover_outcome: resolve ? "resolved" : "unresolved",
                handover_agent_name: clientUserName,
                handover_department: departmentName,
                handover_resolved: resolve,
              },
            }),
          }
        );
        console.log("Patched Voiceflow variables");
      } catch (e) {
        console.error("Failed to patch Voiceflow variables:", e);
      }

      // Step 2: Send success action to resume flow
      try {
        const resumeResponse = await fetch(
          `https://general-runtime.voiceflow.com/state/user/${voiceflowUserId}/interact`,
          {
            method: "POST",
            headers: {
              Authorization: apiKey,
              "Content-Type": "application/json",
              versionID: "production",
            },
            body: JSON.stringify({
              action: { type: "success" },
              config: { tts: false, stripSSML: true },
            }),
          }
        );

        const resumeData = await resumeResponse.json();
        console.log("Voiceflow resumed:", resumeData);

        // Store Voiceflow's resume responses in transcripts
        if (resumeData && Array.isArray(resumeData)) {
          let resumeMessageStored = false;
          for (const item of resumeData) {
            if (item.type === "text" && item.payload?.message && !resumeMessageStored) {
              await supabaseClient.from("transcripts").insert({
                conversation_id: conversationId,
                speaker: "assistant",
                text: item.payload.message,
                metadata: {
                  response_type: "handover_resume",
                  timestamp: new Date().toISOString(),
                },
              });
              resumeMessageStored = true;
            }
          }
        }
      } catch (e) {
        console.error("Failed to resume Voiceflow:", e);
      }
    }
  }

  return { status: newStatus };
}

// =============================================
// ACTION: transfer
// Initiate a department transfer
// =============================================
async function handleTransfer(
  supabaseClient: any,
  body: {
    conversationId: string;
    clientUserId: string;
    clientUserName: string;
    targetDepartmentId: string;
    transferNote: string;
  }
) {
  const {
    conversationId,
    clientUserId,
    clientUserName,
    targetDepartmentId,
    transferNote,
  } = body;
  console.log("Initiating transfer:", {
    conversationId,
    targetDepartmentId,
  });

  // Get the current active session
  const { data: currentSession } = await supabaseClient
    .from("handover_sessions")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("status", "active")
    .single();

  if (!currentSession) {
    throw new Error("No active handover session to transfer from");
  }

  // Get target department details
  const { data: targetDept } = await supabaseClient
    .from("departments")
    .select("*")
    .eq("id", targetDepartmentId)
    .is("deleted_at", null)
    .single();

  if (!targetDept) {
    throw new Error("Target department not found");
  }

  // Complete the current session as transfer
  await supabaseClient
    .from("handover_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completion_method: "transfer",
    })
    .eq("id", currentSession.id);

  // Create new pending session for target department
  const { data: newSession, error: newSessionError } = await supabaseClient
    .from("handover_sessions")
    .insert({
      conversation_id: conversationId,
      voiceflow_user_id: currentSession.voiceflow_user_id,
      department_id: targetDepartmentId,
      original_department_id: currentSession.original_department_id,
      client_user_id: null, // Unassigned — waiting for someone in target dept
      takeover_type: "transfer",
      status: "pending",
      timeout_duration: targetDept.timeout_seconds || 300,
      requested_at: new Date().toISOString(),
      transfer_note: transferNote,
      last_activity_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (newSessionError) {
    console.error("Failed to create transfer session:", newSessionError);
    throw new Error("Failed to initiate transfer");
  }

  // Get agent config for transfer message template
  const { data: conv } = await supabaseClient
    .from("conversations")
    .select("agent_id")
    .eq("id", conversationId)
    .single();

  let transferMessage = `Transferring you to ${targetDept.name}, please wait`;
  if (conv?.agent_id) {
    const { data: agent } = await supabaseClient
      .from("agents")
      .select("config")
      .eq("id", conv.agent_id)
      .single();

    const template =
      agent?.config?.handover_messages?.transfer_message ||
      "Transferring you to {DEPARTMENT}, please wait";
    transferMessage = template.replace("{DEPARTMENT}", targetDept.name);
  }

  // Store transfer system message
  await supabaseClient.from("transcripts").insert({
    conversation_id: conversationId,
    speaker: "system",
    text: transferMessage,
    metadata: {
      type: "transfer_initiated",
      from_user_id: clientUserId,
      from_user_name: clientUserName,
      to_department_id: targetDepartmentId,
      to_department_name: targetDept.name,
      transfer_note: transferNote,
      timestamp: new Date().toISOString(),
    },
  });

  // Update conversation department
  await supabaseClient
    .from("conversations")
    .update({
      department_id: targetDepartmentId,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  return { newSession, targetDepartment: targetDept.name };
}

// =============================================
// ACTION: accept_transfer
// Accept an incoming transfer (same as accept but for transfers)
// =============================================
async function handleAcceptTransfer(
  supabaseClient: any,
  body: {
    conversationId: string;
    clientUserId: string;
    clientUserName: string;
  }
) {
  // Transfers are accepted the same way as regular handovers
  return await handleAcceptHandover(supabaseClient, body);
}

// =============================================
// ACTION: send_message
// Client user sends a message during handover
// =============================================
async function handleSendMessage(
  supabaseClient: any,
  body: {
    conversationId: string;
    clientUserId: string;
    clientUserName: string;
    message: string;
  }
) {
  const { conversationId, clientUserId, clientUserName, message } = body;

  if (!message?.trim()) {
    throw new Error("Message cannot be empty");
  }

  // Verify conversation is in handover and user is the owner
  const { data: conv } = await supabaseClient
    .from("conversations")
    .select("status, owner_id")
    .eq("id", conversationId)
    .single();

  if (!conv) {
    throw new Error("Conversation not found");
  }

  if (conv.status !== "in_handover") {
    throw new Error("Conversation is not in handover");
  }

  if (conv.owner_id !== clientUserId) {
    throw new Error("You are not the owner of this conversation");
  }

  // Store the message
  const { data: transcript, error: transcriptError } = await supabaseClient
    .from("transcripts")
    .insert({
      conversation_id: conversationId,
      speaker: "client_user",
      text: message.trim(),
      metadata: {
        client_user_id: clientUserId,
        client_user_name: clientUserName,
        timestamp: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (transcriptError) {
    console.error("Failed to store message:", transcriptError);
    throw new Error("Failed to send message");
  }

  // Update last_activity_at on conversation and handover session
  await supabaseClient
    .from("conversations")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", conversationId);

  await supabaseClient
    .from("handover_sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("status", "active");

  // Mark as read for the sender
  await supabaseClient
    .from("conversation_read_status")
    .upsert(
      {
        conversation_id: conversationId,
        client_user_id: clientUserId,
        is_read: true,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id,client_user_id" }
    );

  // Mark as unread for all other client users who have a read status
  await supabaseClient
    .from("conversation_read_status")
    .update({ is_read: false })
    .eq("conversation_id", conversationId)
    .neq("client_user_id", clientUserId);

  return { transcript };
}

// =============================================
// ACTION: mark_resolved
// Change Aftercare → Resolved
// =============================================
async function handleMarkResolved(
  supabaseClient: any,
  body: {
    conversationId: string;
    clientUserId: string;
  }
) {
  const { conversationId, clientUserId } = body;
  console.log("Marking as resolved:", conversationId);

  const { data: conv } = await supabaseClient
    .from("conversations")
    .select("status")
    .eq("id", conversationId)
    .single();

  if (!conv) {
    throw new Error("Conversation not found");
  }

  if (conv.status !== "aftercare" && conv.status !== "needs_review") {
    throw new Error(
      "Conversation must be in Aftercare or Needs Review to mark as resolved"
    );
  }

  await supabaseClient
    .from("conversations")
    .update({
      status: "resolved",
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  // Log status change
  await supabaseClient.from("conversation_status_history").insert({
    conversation_id: conversationId,
    from_status: conv.status,
    to_status: "resolved",
    changed_by_type: "client_user",
    changed_by_id: clientUserId,
  });

  return { status: "resolved" };
}
