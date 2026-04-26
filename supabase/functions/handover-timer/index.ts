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
    console.log("Checking for expired pending sessions...");
    
    const { data: pendingSessions, error: pendingError } = await supabaseClient
      .from("handover_sessions")
      .select("*")
      .eq("status", "pending");

    if (pendingError) {
      console.error("Error fetching pending sessions:", pendingError);
      results.errors.push("Failed to fetch pending sessions: " + JSON.stringify(pendingError));
    }

    console.log("Found pending sessions:", pendingSessions?.length || 0);

    if (pendingSessions && pendingSessions.length > 0) {
      const now = Date.now();

      for (const session of pendingSessions) {
        const requestedAt = new Date(session.requested_at).getTime();
        const timeoutMs = (session.timeout_duration || 300) * 1000;
        const elapsed = now - requestedAt;

        console.log("Session", session.id, "- timeout:", session.timeout_duration, "s, elapsed:", Math.floor(elapsed/1000), "s");

        if (elapsed < timeoutMs) {
          console.log("Session", session.id, "not yet expired, skipping");
          continue;
        }

        console.log("Session", session.id, "EXPIRED - processing timeout");

        try {
          // Load department separately to avoid join issues
          let dept = null;
          if (session.department_id) {
            const { data: deptData } = await supabaseClient
              .from("departments")
              .select("name, code, fallback_to_global, is_global, client_id")
              .eq("id", session.department_id)
              .single();
            dept = deptData;
          }

          // Load conversation separately
          let conv = null;
          const { data: convData } = await supabaseClient
            .from("conversations")
            .select("agent_id, voiceflow_user_id")
            .eq("id", session.conversation_id)
            .single();
          conv = convData;

          // Check if fallback to Global is available
          const canFallback = dept?.fallback_to_global && !dept?.is_global && (session.fallback_count || 0) < 1;
          console.log("Can fallback:", canFallback, "dept:", dept?.name, "is_global:", dept?.is_global);

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
              needs_review_reason: "timeout",
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

          // Insert handover_ended so the widget detects the end and fetches resume messages
          await supabaseClient.from("transcripts").insert({
            conversation_id: session.conversation_id,
            speaker: "system",
            text: "Handover ended",
            metadata: {
              type: "handover_ended",
              resolved: false,
              reason: "timeout",
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
          const agentId = conv?.agent_id;
          const voiceflowUserId = conv?.voiceflow_user_id || session.voiceflow_user_id;

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
                let resumeTextStored = false;
                for (const item of resumeData) {
                  if (item.type === "text" && item.payload?.message && !resumeTextStored) {
                    await supabaseClient.from("transcripts").insert({
                      conversation_id: session.conversation_id,
                      speaker: "assistant",
                      text: item.payload.message,
                      metadata: {
                        response_type: "handover_resume",
                        timestamp: new Date().toISOString(),
                      },
                    });
                    resumeTextStored = true;
                  }
                  if (item.type === "choice" && item.payload?.buttons) {
                    await supabaseClient.from("transcripts").insert({
                      conversation_id: session.conversation_id,
                      speaker: "assistant",
                      text: "",
                      buttons: item.payload.buttons.map((btn: any) => ({
                        text: btn.name,
                        payload: btn.request,
                      })),
                      metadata: {
                        response_type: "handover_resume_buttons",
                        timestamp: new Date().toISOString(),
                      },
                    });
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
      .select("*")
      .eq("status", "active");

    if (activeError) {
      console.error("Error fetching active sessions:", activeError);
      results.errors.push("Failed to fetch active sessions");
    }

    if (activeSessions) {
      for (const session of activeSessions) {
        try {
          // Load conversation data separately
          const { data: convData } = await supabaseClient
            .from("conversations")
            .select("agent_id, voiceflow_user_id")
            .eq("id", session.conversation_id)
            .single();
          
          const agentId = convData?.agent_id;
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

          // Find the last human-agent message (speaker='client_user'). Voiceflow AI uses
          // 'assistant' and nudges/system pills use 'system' or 'assistant'+metadata; only
          // 'client_user' represents real agent activity that should keep the chat alive.
          const { data: lastAgentMsg } = await supabaseClient
            .from("transcripts")
            .select("timestamp")
            .eq("conversation_id", session.conversation_id)
            .eq("speaker", "client_user")
            .order("timestamp", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Baseline = latest of: customer msg, agent msg, session accepted_at, inactivity_reset_at.
          // inactivity_reset_at is set by handover-actions on take_over/accept; closes the race
          // where a takeover lands while this loop is mid-iteration.
          const lastCustomerTime = lastUserMsg ? new Date(lastUserMsg.timestamp).getTime() : 0;
          const lastAgentTime = lastAgentMsg ? new Date(lastAgentMsg.timestamp).getTime() : 0;
          const sessionAcceptedTime = session.accepted_at ? new Date(session.accepted_at).getTime() : 0;
          const inactivityResetTime = session.inactivity_reset_at ? new Date(session.inactivity_reset_at).getTime() : 0;
          const inactivityBaseline = Math.max(lastCustomerTime, lastAgentTime, sessionAcceptedTime, inactivityResetTime);

          if (inactivityBaseline === 0) continue; // Nothing to time against — skip

          const now = Date.now();
          const minutesSinceCustomer = (now - inactivityBaseline) / 60000;

          console.log("[inactivity_check]", JSON.stringify({
            sessionId: session.id,
            conversationId: session.conversation_id,
            lastCustomerTime,
            lastAgentTime,
            sessionAcceptedTime,
            inactivityResetTime,
            inactivityBaseline,
            minutesSinceBaseline: Math.round(minutesSinceCustomer * 10) / 10,
            hardTimeoutMinutes,
            willTimeout: hardTimeoutEnabled && minutesSinceCustomer >= hardTimeoutMinutes,
          }));

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
                speaker: "assistant",
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
            // Defence against race: a takeover may have completed this session
            // between our initial fetch and now. Re-read before firing.
            const { data: fresh } = await supabaseClient
              .from("handover_sessions")
              .select("status")
              .eq("id", session.id)
              .single();
            if (fresh?.status !== "active") {
              console.log("[inactivity_skip]", JSON.stringify({
                sessionId: session.id,
                reason: "session_no_longer_active",
                currentStatus: fresh?.status,
              }));
              continue;
            }

            console.log("Inactivity timeout for session:", session.id);

            // Conditional UPDATE: only this run flips active -> inactivity_timeout.
            // If a concurrent run/takeover beat us to it, bail before emitting side effects
            // (system messages, conversation flip, Voiceflow resume) — prevents duplicate
            // "chat ended" pills.
            const { data: updated } = await supabaseClient
              .from("handover_sessions")
              .update({
                status: "inactivity_timeout",
                completed_at: new Date().toISOString(),
                completion_method: "inactivity",
              })
              .eq("id", session.id)
              .eq("status", "active")
              .select("id")
              .maybeSingle();
            if (!updated) {
              console.log("[inactivity_skip]", JSON.stringify({
                sessionId: session.id,
                reason: "status_changed_during_update",
              }));
              continue;
            }

            // Update conversation
            await supabaseClient
              .from("conversations")
              .update({
                status: "needs_review",
                needs_review_reason: "inactivity",
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

            // Insert handover_ended so the widget detects the end and fetches resume messages
            await supabaseClient.from("transcripts").insert({
              conversation_id: session.conversation_id,
              speaker: "system",
              text: "Handover ended",
              metadata: {
                type: "handover_ended",
                resolved: false,
                reason: "inactivity",
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
            const voiceflowUserId = convData?.voiceflow_user_id || session.voiceflow_user_id;
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
                      handover_department: "Support",
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
                let resumeTextStored = false;
                for (const item of resumeData) {
                  if (item.type === "text" && item.payload?.message && !resumeTextStored) {
                    await supabaseClient.from("transcripts").insert({
                      conversation_id: session.conversation_id,
                      speaker: "assistant",
                      text: item.payload.message,
                      metadata: {
                        response_type: "handover_resume",
                        timestamp: new Date().toISOString(),
                      },
                    });
                    resumeTextStored = true;
                  }
                  if (item.type === "choice" && item.payload?.buttons) {
                    await supabaseClient.from("transcripts").insert({
                      conversation_id: session.conversation_id,
                      speaker: "assistant",
                      text: "",
                      buttons: item.payload.buttons.map((btn: any) => ({
                        text: btn.name,
                        payload: btn.request,
                      })),
                      metadata: {
                        response_type: "handover_resume_buttons",
                        timestamp: new Date().toISOString(),
                      },
                    });
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
