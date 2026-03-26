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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const results = {
      pendingTimeouts: 0,
      pendingFallbacks: 0,
      nudgesSent: 0,
      inactivityTimeouts: 0,
      errors: [] as string[],
    };

    // =============================================
    // CHECK 1: Pending sessions past their timeout
    // =============================================
    const { data: expiredPending, error: pendingError } = await supabaseClient
      .from("handover_sessions")
      .select("*, departments:department_id(name, code, fallback_to_global, is_global, client_id), conversations(agent_id, voiceflow_user_id)")
      .eq("status", "pending");

    if (pendingError) {
      console.error("Error fetching pending sessions:", pendingError);
      results.errors.push("Failed to fetch pending sessions");
    }

    if (expiredPending) {
      const now = Date.now();

      for (const session of expiredPending) {
        const requestedAt = new Date(session.requested_at).getTime();
        const timeoutMs = (session.timeout_duration || 300) * 1000;

        if (now - requestedAt < timeoutMs) continue; // Not yet expired

        console.log("Pending session expired:", session.id);

        try {
          // Check if fallback to Global is available
          const dept = session.departments;
          const canFallback = dept?.fallback_to_global && !dept?.is_global && session.fallback_count < 1;

          if (canFallback) {
            // Fallback to Global department
            const { data: globalDept } = await supabaseClient
              .from("departments")
              .select("id, name, timeout_seconds")
              .eq("client_id", dept.client_id)
              .eq("is_global", true)
              .is("deleted_at", null)
              .single();

            if (globalDept) {
              console.log("Falling back to Global department for session:", session.id);

              // Complete current session
              await supabaseClient
                .from("handover_sessions")
                .update({
                  status: "completed",
                  completed_at: new Date().toISOString(),
                  completion_method: "transfer",
                })
                .eq("id", session.id);

              // Create new pending session for Global
              await supabaseClient.from("handover_sessions").insert({
                conversation_id: session.conversation_id,
                voiceflow_user_id: session.voiceflow_user_id,
                department_id: globalDept.id,
                original_department_id: session.original_department_id || session.department_id,
                takeover_type: "transfer",
                status: "pending",
                timeout_duration: globalDept.timeout_seconds || 300,
                requested_at: new Date().toISOString(),
                transfer_note: `Auto-fallback from ${dept.name} (timeout)`,
                fallback_occurred: true,
                fallback_count: (session.fallback_count || 0) + 1,
                last_activity_at: new Date().toISOString(),
              });

              // Update conversation department
              await supabaseClient
                .from("conversations")
                .update({ department_id: globalDept.id })
                .eq("id", session.conversation_id);

              // Store system message
              await supabaseClient.from("transcripts").insert({
                conversation_id: session.conversation_id,
                speaker: "system",
                text: `No response from ${dept.name}. Transferring to ${globalDept.name}...`,
                metadata: {
                  type: "timeout_fallback",
                  from_department: dept.name,
                  to_department: globalDept.name,
                  timestamp: new Date().toISOString(),
                },
              });

              results.pendingFallbacks++;
              continue;
            }
          }

          // No fallback available — timeout the session
          console.log("Timing out session:", session.id);

          await supabaseClient
            .from("handover_sessions")
            .update({
              status: "timeout",
              completed_at: new Date().toISOString(),
              completion_method: "timeout",
            })
            .eq("id", session.id);

          // Update conversation
          await supabaseClient
            .from("conversations")
            .update({
              status: "needs_review",
              last_activity_at: new Date().toISOString(),
            })
            .eq("id", session.conversation_id);

          // Tag conversation
          await supabaseClient
            .from("conversation_tags")
            .upsert(
              {
                conversation_id: session.conversation_id,
                tag_name: "missed",
                is_system: true,
              },
              { onConflict: "conversation_id,tag_name", ignoreDuplicates: true }
            );

          // Store system message
          await supabaseClient.from("transcripts").insert({
            conversation_id: session.conversation_id,
            speaker: "system",
            text: "No agents available at the moment",
            metadata: {
              type: "handover_timeout",
              timestamp: new Date().toISOString(),
            },
          });

          // Log status change
          await supabaseClient.from("conversation_status_history").insert({
            conversation_id: session.conversation_id,
            from_status: "with_ai",
            to_status: "needs_review",
            changed_by_type: "system",
            metadata: { reason: "handover_timeout" },
          });

          // Resume Voiceflow with timeout path
          const agentId = session.conversations?.agent_id;
          const voiceflowUserId = session.conversations?.voiceflow_user_id || session.voiceflow_user_id;

          if (agentId && voiceflowUserId) {
            const { data: agent } = await supabaseClient
              .from("agents")
              .select("config")
              .eq("id", agentId)
              .single();

            const apiKey = agent?.config?.api_key;
            if (apiKey) {
              // PATCH variables
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
                      handover_outcome: "timeout",
                      handover_agent_name: null,
                      handover_department: dept?.name || "Support",
                      handover_resolved: false,
                    },
                  }),
                }
              );

              // Send timeout action to resume flow
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
                    action: { type: "timeout" },
                    config: { tts: false, stripSSML: true },
                  }),
                }
              );

              // Store resume responses
              const resumeData = await resumeResponse.json();
              if (resumeData && Array.isArray(resumeData)) {
                for (const item of resumeData) {
                  if (item.type === "text" && item.payload?.message) {
                    await supabaseClient.from("transcripts").insert({
                      conversation_id: session.conversation_id,
                      speaker: "assistant",
                      text: item.payload.message,
                      metadata: {
                        response_type: "timeout_resume",
                        timestamp: new Date().toISOString(),
                      },
                    });
                    break; // Only store first message
                  }
                }
              }
            }
          }

          results.pendingTimeouts++;
        } catch (e) {
          console.error("Error processing expired session:", session.id, e);
          results.errors.push(`Session ${session.id}: ${e}`);
        }
      }
    }

    // =============================================
    // CHECK 2 & 3: Customer inactivity (nudge + hard timeout)
    // =============================================
    const { data: activeSessions, error: activeError } = await supabaseClient
      .from("handover_sessions")
      .select("*, conversations(agent_id, voiceflow_user_id, id)")
      .eq("status", "active");

    if (activeError) {
      console.error("Error fetching active sessions:", activeError);
      results.errors.push("Failed to fetch active sessions");
    }

    if (activeSessions) {
      for (const session of activeSessions) {
        try {
          const agentId = session.conversations?.agent_id;
          if (!agentId) continue;

          // Load agent config for inactivity settings
          const { data: agent } = await supabaseClient
            .from("agents")
            .select("config")
            .eq("id", agentId)
            .single();

          const inactivityConfig = agent?.config?.handover_inactivity || {};
          const nudgeEnabled = inactivityConfig.nudge_enabled !== false; // Default true
          const nudgeDelayMinutes = inactivityConfig.nudge_delay_minutes || 5;
          const nudgeMessage = inactivityConfig.nudge_message || "Are you still there? Let us know if you need anything else.";
          const nudgeRepeat = inactivityConfig.nudge_repeat || "once";
          const nudgeRepeatInterval = inactivityConfig.nudge_repeat_interval_minutes || 5;
          const hardTimeoutEnabled = inactivityConfig.hard_timeout_enabled !== false; // Default true
          const hardTimeoutMinutes = inactivityConfig.hard_timeout_minutes || 20;

          // Find the last customer message timestamp for this conversation
          const { data: lastUserMsg } = await supabaseClient
            .from("transcripts")
            .select("timestamp")
            .eq("conversation_id", session.conversation_id)
            .eq("speaker", "user")
            .order("timestamp", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!lastUserMsg) continue; // No customer messages yet — skip

          const lastCustomerTime = new Date(lastUserMsg.timestamp).getTime();
          const now = Date.now();
          const minutesSinceCustomer = (now - lastCustomerTime) / 60000;

          // --- NUDGE CHECK ---
          if (nudgeEnabled && minutesSinceCustomer >= nudgeDelayMinutes) {
            // Check if nudge was already sent
            const { data: existingNudges } = await supabaseClient
              .from("transcripts")
              .select("id, timestamp")
              .eq("conversation_id", session.conversation_id)
              .eq("speaker", "system")
              .contains("metadata", { type: "inactivity_nudge" })
              .order("timestamp", { ascending: false })
              .limit(1);

            const lastNudge = existingNudges?.[0];
            let shouldNudge = false;

            if (!lastNudge) {
              // No nudge sent yet
              shouldNudge = true;
            } else if (nudgeRepeat === "repeat") {
              // Check if enough time has passed since last nudge
              const lastNudgeTime = new Date(lastNudge.timestamp).getTime();
              const minutesSinceNudge = (now - lastNudgeTime) / 60000;
              if (minutesSinceNudge >= nudgeRepeatInterval) {
                // Also verify customer hasn't responded since the last nudge
                if (lastCustomerTime < lastNudgeTime) {
                  shouldNudge = true;
                }
              }
            }

            if (shouldNudge) {
              console.log("Sending inactivity nudge for session:", session.id);

              await supabaseClient.from("transcripts").insert({
                conversation_id: session.conversation_id,
                speaker: "system",
                text: nudgeMessage,
                metadata: {
                  type: "inactivity_nudge",
                  minutes_inactive: Math.floor(minutesSinceCustomer),
                  timestamp: new Date().toISOString(),
                },
              });

              results.nudgesSent++;
            }
          }

          // --- HARD TIMEOUT CHECK ---
          if (hardTimeoutEnabled && minutesSinceCustomer >= hardTimeoutMinutes) {
            console.log("Inactivity timeout for session:", session.id);

            // Complete the session
            await supabaseClient
              .from("handover_sessions")
              .update({
                status: "inactivity_timeout",
                completed_at: new Date().toISOString(),
                completion_method: "inactivity",
              })
              .eq("id", session.id);

            // Update conversation
            await supabaseClient
              .from("conversations")
              .update({
                status: "needs_review",
                last_activity_at: new Date().toISOString(),
              })
              .eq("id", session.conversation_id);

            // Store system message
            await supabaseClient.from("transcripts").insert({
              conversation_id: session.conversation_id,
              speaker: "system",
              text: "Conversation closed due to inactivity",
              metadata: {
                type: "inactivity_timeout",
                minutes_inactive: Math.floor(minutesSinceCustomer),
                timestamp: new Date().toISOString(),
              },
            });

            // Log status change
            await supabaseClient.from("conversation_status_history").insert({
              conversation_id: session.conversation_id,
              from_status: "in_handover",
              to_status: "needs_review",
              changed_by_type: "system",
              metadata: { reason: "inactivity_timeout" },
            });

            // Resume Voiceflow with inactivity_timeout path
            const voiceflowUserId = session.conversations?.voiceflow_user_id || session.voiceflow_user_id;
            const apiKey = agent?.config?.api_key;

            if (apiKey && voiceflowUserId) {
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
                      handover_outcome: "inactivity_timeout",
                      handover_agent_name: null,
                      handover_department: session.departments?.name || "Support",
                      handover_resolved: false,
                    },
                  }),
                }
              );

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
                    action: { type: "inactivity_timeout" },
                    config: { tts: false, stripSSML: true },
                  }),
                }
              );

              const resumeData = await resumeResponse.json();
              if (resumeData && Array.isArray(resumeData)) {
                for (const item of resumeData) {
                  if (item.type === "text" && item.payload?.message) {
                    await supabaseClient.from("transcripts").insert({
                      conversation_id: session.conversation_id,
                      speaker: "assistant",
                      text: item.payload.message,
                      metadata: {
                        response_type: "inactivity_resume",
                        timestamp: new Date().toISOString(),
                      },
                    });
                    break;
                  }
                }
              }
            }

            results.inactivityTimeouts++;
          }
        } catch (e) {
          console.error("Error processing active session:", session.id, e);
          results.errors.push(`Active session ${session.id}: ${e}`);
        }
      }
    }

    console.log("Handover timer results:", results);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in handover-timer:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
