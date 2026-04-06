import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to create a transcript for a conversation
async function createTranscriptForConversation(
  supabaseClient: any,
  conversation: {
    id: string;
    agent_id: string;
    started_at: string;
    ended_at: string | null;
    metadata: Record<string, any>;
  },
) {
  console.log("Creating transcript for conversation:", conversation.id);

  const { data: messages, error: messagesError } = await supabaseClient
    .from("transcripts")
    .select("speaker, text, timestamp, buttons, metadata")
    .eq("conversation_id", conversation.id)
    .order("timestamp", { ascending: true });

  if (messagesError) {
    console.error("Error fetching messages for transcript:", messagesError);
    throw messagesError;
  }

  let duration = null;
  if (conversation.ended_at && conversation.started_at) {
    const start = new Date(conversation.started_at).getTime();
    const end = new Date(conversation.ended_at).getTime();
    duration = Math.floor((end - start) / 1000);
  }

  const variables = conversation.metadata?.variables || {};
  const userName = variables.user_name || null;
  const userEmail = variables.user_email || null;
  const userPhone = variables.user_phone || null;

  const { error: insertError } = await supabaseClient.from("text_transcripts").insert({
    source_conversation_id: conversation.id,
    agent_id: conversation.agent_id,
    user_name: userName,
    user_email: userEmail,
    user_phone: userPhone,
    conversation_started_at: conversation.started_at,
    conversation_ended_at: conversation.ended_at,
    duration,
    message_count: messages?.length || 0,
    captured_variables: variables,
    messages: messages || [],
  });

  if (insertError) {
    console.error("Error creating transcript:", insertError);
    throw insertError;
  }

  console.log("Transcript created successfully for conversation:", conversation.id);
}

// Helper: check if a department is currently open based on its timezone and hours
function isDepartmentOpen(dept: any): boolean {
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
    const hour = parts.find((p: any) => p.type === "hour")?.value || "00";
    const minute = parts.find((p: any) => p.type === "minute")?.value || "00";
    const currentTime = `${hour}:${minute}`;
    const dayName = parts.find((p: any) => p.type === "weekday")?.value?.toLowerCase() || "monday";

    if (dept.opening_hours_type === "simple") {
      const hours = dept.opening_hours?.simple;
      if (!hours?.open || !hours?.close) return true; // No hours set = always open
      return currentTime >= hours.open && currentTime < hours.close;
    } else if (dept.opening_hours_type === "advanced") {
      const dayHours = dept.opening_hours?.advanced?.[dayName];
      if (!dayHours?.enabled) return false;
      return currentTime >= dayHours.open && currentTime < dayHours.close;
    }
    return true; // Default to open
  } catch {
    return true; // On error, assume open
  }
}

// Helper: get client_id from agent_id via agent_assignments
async function getClientIdForAgent(supabaseClient: any, agentId: string): Promise<string | null> {
  const { data, error } = await supabaseClient
    .from("agent_assignments")
    .select("client_id")
    .eq("agent_id", agentId)
    .limit(1)
    .single();
  if (error || !data) return null;
  return data.client_id;
}

// Helper: look up department by code for a client
async function getDepartmentByCode(supabaseClient: any, clientId: string, code: string): Promise<any | null> {
  const { data, error } = await supabaseClient
    .from("departments")
    .select("*")
    .eq("client_id", clientId)
    .eq("code", code)
    .is("deleted_at", null)
    .single();
  if (error || !data) return null;
  return data;
}

// Helper: get the Global department for a client
async function getGlobalDepartment(supabaseClient: any, clientId: string): Promise<any | null> {
  const { data, error } = await supabaseClient
    .from("departments")
    .select("*")
    .eq("client_id", clientId)
    .eq("is_global", true)
    .is("deleted_at", null)
    .single();
  if (error || !data) return null;
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentId, userId, message, action, conversationId, isTestMode, baseUserId } = await req.json();

    console.log("Voiceflow interact request:", { agentId, userId, action, isTestMode });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Fetch agent details
    const { data: agent, error: agentError } = await supabaseClient
      .from("agents")
      .select("config")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      console.error("Agent fetch error:", agentError);
      throw new Error("Agent not found");
    }

    const apiKey = agent.config?.api_key;
    const projectId = agent.config?.project_id;

    if (!apiKey || !projectId) {
      throw new Error("Agent missing Voiceflow credentials");
    }

    // =============================================
    // HANDOVER CHECK: If conversation exists, check its status
    // before calling Voiceflow. This is the three-way routing.
    // =============================================
    let conversationResolved = false;

    if (conversationId && (action === "text" || action === "button")) {
      // Fetch conversation status (we need this anyway for last_activity_at)
      const { data: existingConv } = await supabaseClient
        .from("conversations")
        .select("id, status, owner_id, agent_id, voiceflow_user_id, ended_at")
        .eq("id", conversationId)
        .single();

      if (existingConv) {
        // --- ENDED: Only skip if conversation has truly ended (VF End block reached) ---
        if (existingConv.ended_at) {
          console.log("Conversation has ended (ended_at set), will create new conversation:", conversationId);
          conversationResolved = true;
        }

        // --- PATH 1: Active handover (human is chatting) ---
        else if (existingConv.status === "in_handover") {
          console.log("Conversation in handover, routing to dashboard:", conversationId);

          // Store the customer's message in transcripts
          const userMessageText =
            action === "button" ? JSON.parse(message).payload?.label || "Button clicked" : message;

          await supabaseClient.from("transcripts").insert({
            conversation_id: conversationId,
            speaker: "user",
            text: userMessageText,
            metadata: { timestamp: new Date().toISOString() },
          });

          // Update last_activity_at and last_customer_message_at
          await supabaseClient.rpc('update_customer_message_timestamps', {
            p_conversation_id: conversationId,
          });

          // Also update the handover session's last_activity_at
          await supabaseClient
            .from("handover_sessions")
            .update({ last_activity_at: new Date().toISOString() })
            .eq("conversation_id", conversationId)
            .eq("status", "active");

          return new Response(
            JSON.stringify({
              conversationId,
              botResponses: [],
              userId,
              handoverActive: true,
              conversationEnded: false,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
          );
        }

        // --- PATH 2: Pending handover request (waiting for acceptance) ---
        const { data: pendingSession } = await supabaseClient
          .from("handover_sessions")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("status", "pending")
          .maybeSingle();

        if (pendingSession) {
          console.log("Conversation has pending handover, returning holding message:", conversationId);

          // Store the customer's message in transcripts
          const userMessageText =
            action === "button" ? JSON.parse(message).payload?.label || "Button clicked" : message;

          await supabaseClient.from("transcripts").insert({
            conversation_id: conversationId,
            speaker: "user",
            text: userMessageText,
            metadata: { timestamp: new Date().toISOString() },
          });

          // Update last_activity_at and last_customer_message_at
          await supabaseClient.rpc('update_customer_message_timestamps', {
            p_conversation_id: conversationId,
          });

          // Get holding message configuration
          const holdingMessage =
            agent.config?.handover_messages?.holding_message ||
            "We're connecting you with a team member, please hold...";
          const repeatMode = agent.config?.handover_settings?.holding_message_repeat || "once";

          // Check if we've already sent a holding message (for "once" mode)
          let shouldSendHolding = true;
          if (repeatMode === "once") {
            const { data: existingHolding } = await supabaseClient
              .from("transcripts")
              .select("id")
              .eq("conversation_id", conversationId)
              .eq("speaker", "assistant")
              .contains("metadata", { type: "holding_message" })
              .limit(1);

            if (existingHolding && existingHolding.length > 0) {
              shouldSendHolding = false;
            }
          }

          // Store and return holding message
          const botResponses: any[] = [];
          if (shouldSendHolding) {
            await supabaseClient.from("transcripts").insert({
              conversation_id: conversationId,
              speaker: "assistant",
              text: holdingMessage,
              metadata: { type: "holding_message", timestamp: new Date().toISOString() },
            });
            botResponses.push({ type: "text", text: holdingMessage });
          }

          return new Response(
            JSON.stringify({
              conversationId,
              botResponses,
              userId,
              handoverPending: true,
              conversationEnded: false,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
          );
        }
      }
    }

    // =============================================
    // NORMAL VOICEFLOW FLOW (no active handover)
    // =============================================

    // Build Voiceflow request based on action type
    let voiceflowRequestBody: any;

    // Handle reset action
    if (action === "reset") {
      console.log("Resetting Voiceflow state for user:", userId);

      const deleteResponse = await fetch(`https://general-runtime.voiceflow.com/state/user/${userId}`, {
        method: "DELETE",
        headers: { Authorization: apiKey },
      });

      if (!deleteResponse.ok) {
        console.warn("Failed to delete Voiceflow state:", await deleteResponse.text());
      }

      return new Response(JSON.stringify({ success: true, message: "State reset complete" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Voiceflow config — includes stopTypes for handover detection
    const vfConfig = {
      tts: false,
      stripSSML: true,
      stopTypes: ["request_handoff"],
    };

    if (action === "launch") {
      voiceflowRequestBody = {
        action: { type: "launch" },
        config: vfConfig,
      };
      console.log("Sending launch request to Voiceflow");
    } else if (action === "button") {
      try {
        const buttonPayload = JSON.parse(message);
        voiceflowRequestBody = {
          action: buttonPayload,
          config: vfConfig,
        };
        console.log("Sending button action to Voiceflow:", buttonPayload);
      } catch (error) {
        console.error("Failed to parse button payload:", error);
        throw new Error("Invalid button payload");
      }
    } else {
      voiceflowRequestBody = {
        action: { type: "text", payload: message },
        config: vfConfig,
      };
      console.log("Sending text message to Voiceflow:", message);
    }

    // Call Voiceflow Interact API (with versionID for production)
    const voiceflowResponse = await fetch(`https://general-runtime.voiceflow.com/state/user/${userId}/interact`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        versionID: "production",
      },
      body: JSON.stringify(voiceflowRequestBody),
    });

    if (!voiceflowResponse.ok) {
      const errorText = await voiceflowResponse.text();
      console.error("Voiceflow API error:", errorText);
      throw new Error("Voiceflow API request failed");
    }

    const voiceflowData = await voiceflowResponse.json();
    console.log("Voiceflow response:", voiceflowData);

    // =============================================
    // CHECK FOR HANDOVER CUSTOM ACTION TRACE
    // =============================================
    let handoverRequested = false;
    let handoverDepartmentCode: string | null = null;

    let isConversationEnded = false;
    if (voiceflowData && Array.isArray(voiceflowData)) {
      for (const item of voiceflowData) {
        if (item.type === "end") {
          isConversationEnded = true;
          console.log("Detected conversation end trace from Voiceflow");
        }
        // Detect the request_handoff Custom Action trace
        if (item.type === "request_handoff") {
          handoverRequested = true;
          try {
            const payload = typeof item.payload === "string" ? JSON.parse(item.payload) : item.payload;
            handoverDepartmentCode = payload?.department || null;
          } catch {
            handoverDepartmentCode = null;
          }
          console.log("Detected handover request! Department:", handoverDepartmentCode);
        }
      }
    }

    // Fetch current state to get variables
    let voiceflowVariables: Record<string, any> = {};
    try {
      const stateResponse = await fetch(`https://general-runtime.voiceflow.com/state/user/${userId}`, {
        method: "GET",
        headers: { Authorization: apiKey },
      });

      if (stateResponse.ok) {
        const stateData = await stateResponse.json();
        voiceflowVariables = stateData?.variables || {};
      }
    } catch (stateError) {
      console.error("Error fetching Voiceflow state:", stateError);
    }

    // Parse Voiceflow response (normal traces — text, choice)
    const botResponses: any[] = [];

    if (voiceflowData && Array.isArray(voiceflowData)) {
      for (const item of voiceflowData) {
        if (item.type === "text" && item.payload?.message) {
          botResponses.push({ type: "text", text: item.payload.message });
        } else if (item.type === "choice" && item.payload?.buttons) {
          botResponses.push({
            type: "choice",
            buttons: item.payload.buttons.map((btn: any) => ({
              text: btn.name,
              payload: btn.request,
            })),
          });
        }
      }
    }

    // Create or get conversation (skip resolved — force new)
    let currentConversationId = conversationResolved ? null : conversationId;

    if (!currentConversationId) {
      const { data: newConversation, error: convError } = await supabaseClient
        .from("conversations")
        .insert({
          agent_id: agentId,
          caller_phone: userId,
          status: "with_ai",
          is_widget_test: isTestMode,
          voiceflow_user_id: userId,
          customer_base_id: baseUserId || null,
          metadata: {
            source: isTestMode ? "widget_test" : "widget",
            variables: {},
          },
        })
        .select()
        .single();

      if (convError) {
        console.error("Error creating conversation:", convError);
        throw convError;
      }

      currentConversationId = newConversation.id;
    }

    // Update conversation with captured variables and voiceflow_user_id
    if (currentConversationId && Object.keys(voiceflowVariables).length > 0) {
      const { error: updateError } = await supabaseClient
        .from("conversations")
        .update({
          voiceflow_user_id: userId,
          metadata: {
            source: isTestMode ? "widget_test" : "widget",
            variables: voiceflowVariables,
            last_updated: new Date().toISOString(),
          },
        })
        .eq("id", currentConversationId);

      if (updateError) {
        console.error("Error updating conversation metadata:", updateError);
      }
    }

    // Store user message in transcripts
    if ((action === "text" || action === "button") && currentConversationId) {
      const userMessageText = action === "button" ? JSON.parse(message).payload?.label || "Button clicked" : message;

      await supabaseClient.from("transcripts").insert({
        conversation_id: currentConversationId,
        speaker: "user",
        text: userMessageText,
        metadata:
          action === "button"
            ? {
                button_click: true,
                payload: JSON.parse(message),
                timestamp: new Date().toISOString(),
              }
            : {},
      });

      await supabaseClient.rpc('update_customer_message_timestamps', {
        p_conversation_id: currentConversationId,
      });
    }

    // =============================================
    // HANDLE HANDOVER REQUEST
    // =============================================
    if (handoverRequested && currentConversationId) {
      console.log("Processing handover request for conversation:", currentConversationId);

      const clientId = await getClientIdForAgent(supabaseClient, agentId);

      if (clientId) {
        // Look up the requested department (or fall back to Global)
        let department = null;
        if (handoverDepartmentCode) {
          department = await getDepartmentByCode(supabaseClient, clientId, handoverDepartmentCode);
        }
        if (!department) {
          department = await getGlobalDepartment(supabaseClient, clientId);
        }

        if (department) {
          // Check if department is currently open
          const isOpen = isDepartmentOpen(department);

          if (!isOpen) {
            console.log("Department is closed:", department.name);

            // Try fallback to Global if enabled
            let fallbackDept = null;
            if (department.fallback_out_of_hours && !department.is_global) {
              fallbackDept = await getGlobalDepartment(supabaseClient, clientId);
              if (fallbackDept && isDepartmentOpen(fallbackDept)) {
                console.log("Falling back to Global department (out of hours)");
                department = fallbackDept;
              } else {
                fallbackDept = null;
              }
            }

            if (!fallbackDept && !isOpen) {
              // No fallback available — send department_closed back to Voiceflow
              console.log("No available department, sending department_closed to Voiceflow");

              // Tag the conversation
              await supabaseClient
                .from("conversation_tags")
                .upsert(
                  {
                    conversation_id: currentConversationId,
                    tag_name: "out_of_hours",
                    is_system: true,
                  },
                  { onConflict: "conversation_id,tag_name", ignoreDuplicates: true }
                );

              // Update conversation status
              await supabaseClient
                .from("conversations")
                .update({ status: "needs_review", department_id: department.id, needs_review_reason: "department_closed" })
                .eq("id", currentConversationId);

              // Resume Voiceflow with department_closed path
              // First PATCH variables
              await fetch(`https://general-runtime.voiceflow.com/state/user/${userId}`, {
                method: "PATCH",
                headers: { Authorization: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({
                  variables: {
                    handover_outcome: "department_closed",
                    handover_agent_name: null,
                    handover_department: department.name,
                    handover_resolved: false,
                  },
                }),
              });

              // Then send the department_closed action
              const resumeResponse = await fetch(
                `https://general-runtime.voiceflow.com/state/user/${userId}/interact`,
                {
                  method: "POST",
                  headers: {
                    Authorization: apiKey,
                    "Content-Type": "application/json",
                    versionID: "production",
                  },
                  body: JSON.stringify({
                    action: { type: "department_closed" },
                    config: { tts: false, stripSSML: true },
                  }),
                },
              );

              // Parse the resume response for bot messages
              const resumeData = await resumeResponse.json();
              const resumeResponses: any[] = [];
              if (resumeData && Array.isArray(resumeData)) {
                for (const item of resumeData) {
                  if (item.type === "text" && item.payload?.message) {
                    resumeResponses.push({ type: "text", text: item.payload.message });
                  }
                }
              }

              // Store resume responses in transcripts
              for (const resp of resumeResponses) {
                await supabaseClient.from("transcripts").insert({
                  conversation_id: currentConversationId,
                  speaker: "assistant",
                  text: resp.text || "",
                  metadata: { response_type: "department_closed_response", timestamp: new Date().toISOString() },
                });
              }

              return new Response(
                JSON.stringify({
                  conversationId: currentConversationId,
                  botResponses: resumeResponses,
                  userId,
                  conversationEnded: false,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
              );
            }
          }

          // Department is open (or fallback is open) — create handover session
          console.log("Creating handover session for department:", department.name);

          const { error: sessionError } = await supabaseClient.from("handover_sessions").insert({
            conversation_id: currentConversationId,
            voiceflow_user_id: userId,
            department_id: department.id,
            original_department_id: department.id,
            takeover_type: "requested",
            status: "pending",
            timeout_duration: department.timeout_seconds || 300,
            requested_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
          });

          if (sessionError) {
            console.error("Error creating handover session:", sessionError);
          }

          // Update conversation with department
          await supabaseClient
            .from("conversations")
            .update({ status: "waiting", department_id: department.id, voiceflow_user_id: userId })
            .eq("id", currentConversationId);

          // Store bot responses that came with this handover (e.g. "Let me connect you to our team")
          if (currentConversationId) {
            for (const response of botResponses) {
              if (response.text) {
                await supabaseClient.from("transcripts").insert({
                  conversation_id: currentConversationId,
                  speaker: "assistant",
                  text: response.text,
                  metadata: {
                    response_type: "pre_handover",
                    timestamp: new Date().toISOString(),
                  },
                });
              }
            }
          }

          // Store the connecting system message
          const connectingMessage =
            agent.config?.handover_messages?.connecting_message || "Connecting you with our team...";

          await supabaseClient.from("transcripts").insert({
            conversation_id: currentConversationId,
            speaker: "system",
            text: connectingMessage,
            metadata: { type: "handover_requested", department: department.name, timestamp: new Date().toISOString() },
          });

          // Return handover active flag — connecting message comes through polling as system transcript
          return new Response(
            JSON.stringify({
              conversationId: currentConversationId,
              botResponses,
              userId,
              handoverActive: true,
              conversationEnded: false,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
          );
        }
      }

      // If we couldn't find a client or department, log and continue normally
      console.warn("Could not process handover: no client or department found for agent:", agentId);
    }

    // =============================================
    // NORMAL FLOW: Store bot responses in transcripts
    // =============================================
    if (currentConversationId) {
      for (const response of botResponses) {
        await supabaseClient.from("transcripts").insert({
          conversation_id: currentConversationId,
          speaker: "assistant",
          text: response.text || "",
          buttons: response.buttons || null,
          metadata: {
            response_type: response.type,
            timestamp: new Date().toISOString(),
            full_trace: voiceflowData,
          },
        });
      }

      await supabaseClient
        .from("conversations")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", currentConversationId);
    }

    // If conversation ended, update it and create transcript
    if (isConversationEnded && currentConversationId) {
      const endedAt = new Date().toISOString();
      console.log("Ending conversation and creating transcript:", currentConversationId);

      const { error: endError } = await supabaseClient
        .from("conversations")
        .update({ ended_at: endedAt, status: "resolved" })
        .eq("id", currentConversationId);

      // Store conversation ended system message
      await supabaseClient.from("transcripts").insert({
        conversation_id: currentConversationId,
        speaker: "system",
        text: "Conversation ended",
        metadata: {
          type: "conversation_ended",
          timestamp: new Date().toISOString(),
        },
      });

      if (endError) {
        console.error("Error ending conversation:", endError);
      } else {
        const { data: convData, error: convFetchError } = await supabaseClient
          .from("conversations")
          .select("id, agent_id, started_at, ended_at, metadata")
          .eq("id", currentConversationId)
          .single();

        if (!convFetchError && convData) {
          try {
            await createTranscriptForConversation(supabaseClient, convData);
          } catch (transcriptError) {
            console.error("Error creating transcript:", transcriptError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        conversationId: currentConversationId,
        botResponses,
        userId,
        conversationEnded: isConversationEnded,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("Error in voiceflow-interact:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
