
## Plan: Create and Deploy `handover-actions` Edge Function

Two files to touch, then deploy.

### 1. Create `supabase/functions/handover-actions/index.ts`
Write the file exactly as provided by the user — no code changes.

### 2. Add config entry to `supabase/config.toml`
Append the following block (function handles authenticated client users performing handover actions, so `verify_jwt = true`):
```toml
[functions.handover-actions]
verify_jwt = true
```

### 3. Deploy
Trigger deployment of the `handover-actions` function via the Supabase deploy tool.

---

**No database migrations needed** — the function uses existing tables: `handover_sessions`, `conversations`, `conversation_status_history`, `transcripts`, `conversation_read_status`, `agents`, `departments`, `agent_assignments`.
