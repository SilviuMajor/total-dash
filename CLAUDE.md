# CLAUDE.md — TotalDash

> Read this file at the start of every session before doing any work. It's the working manual for Claude Code on this project.

## What this is

TotalDash is a multi-tenant SaaS customer-service dashboard for AI chatbot agents (Voiceflow/Retell). Built by Silv, owner of Fiveleaf (UK agency). The immediate priority is migrating the first client (HeyB) from a third-party platform onto TotalDash. Platform must be production-ready and bug-free before that migration.

## Who runs this

Silv is the only person editing this codebase. No team, no reviewers. This means:
- Skip explanations aimed at future contributors — he knows the stack
- Don't add defensive commentary in commits
- Bold defaults are fine; no need to preserve every flag for "optionality"

## Tech stack

- **Frontend:** React + Vite + TypeScript + Tailwind + shadcn/ui (`src/`)
- **Backend:** Supabase — Postgres, Auth, Edge Functions, RLS, Realtime (`supabase/`)
- **Supabase project ref:** `nznfznjlroycddegwvpt`
- **Hosting:** Production Supabase directly. No staging environment yet (will add branching when HeyB migrates).

## How Silv works with Claude

There are two Claudes involved.

1. **Claude in the web/mac chat (planning Claude)** — handles strategy, specs, brainstorms, architecture decisions, project memory across weeks, documentation. Silv talks to this Claude first when he wants to figure out *what* to do.
2. **You — Claude Code (implementation Claude)** — reads and edits files, runs deploys, diagnoses bugs live. Silv hands you a spec from the planning Claude and you make it happen. You also handle small bugs and tweaks directly without a spec.

Silv pastes specs from the planning Claude into you. Treat those specs as authoritative — they've already been thought through. Don't re-litigate design decisions that have already been made; just implement.

## Workflow defaults

**Commit and push behaviour.** After any meaningful code change, commit and push automatically to `main`. Write a short, descriptive commit message (e.g. "Fix widget-loader CSS escaping in attachment preview row"). Don't ask permission for each commit. Do ask if a change seems destructive (deleting large files, changing schemas, etc.).

**Auto-deploy.** Pushes to `main` trigger a GitHub Actions workflow that auto-deploys any Edge Functions whose files changed. No manual `supabase functions deploy` commands needed. If an Edge Function isn't deploying after a push, check the Actions tab on GitHub.

**Testing.** Silv tests changes by hitting the live URL after deploy. The widget embed is on a Framer page. When a change is shipped, tell Silv explicitly that it's deployed and what to hard-refresh to see it. Hard-refresh = Cmd+Shift+R on Mac.

**When something breaks.** Diagnose before guessing. Read the actual file. Pull the latest if unsure. Check the browser console for JS errors, Supabase logs for Edge Function errors. Don't propose speculative fixes without first checking what broke.

**If the first fix attempt fails.** Investigate root cause, try a different angle. Don't defer problems to "tech debt" unless Silv explicitly agrees it's not worth fixing now.

## Critical rules

These are painful rules Silv has learned the hard way. Do NOT violate them without explicit agreement.

### 1. Agent config save pattern

The `agents_safe` view strips API keys (`api_key`, `project_id`, etc.) from `config` JSONB. If you do `config: { ...agent.config, newKey: value }` where `agent.config` came from `agents_safe`, you'll wipe the API credentials and break the Voiceflow widget.

**Always use the `update_agent_config` RPC for config saves:**

```typescript
// CORRECT — server-side JSONB merge, never touches API keys
await supabase.rpc('update_agent_config', {
  p_agent_id: agent.id,
  p_config_updates: { resolution_reasons: reasons, auto_end_hours: hours },
});

// WRONG — wipes API keys if loaded from agents_safe
await supabase.from("agents").update({
  config: { ...agent.config, resolution_reasons: reasons }
}).eq("id", agent.id);
```

Affects everything under `src/components/agent-management/voiceflow/` on the client side. `VoiceflowSettings.tsx` (agency-side) loads from full `agents` table so is not affected.

### 2. `isDepartmentOpen` is duplicated

Exists in TWO places:
- `supabase/functions/voiceflow-interact/index.ts` (Edge Function — actual routing)
- `src/components/client-management/DepartmentManagement.tsx` (Frontend — display only)

Any change to department-open logic (e.g. `always_open` bypass) must be applied to BOTH. Missing one causes inconsistency between what the widget does and what the admin UI shows.

### 3. Use `agents_safe` view for client-facing queries

Client pages (anything under `src/pages/client/` and `src/components/client-management/`) must select from `agents_safe`, not `agents` directly. The view strips API credentials from `config` so they're never exposed to client users.

### 4. Use `is_super_admin()` in new RLS policies

`is_admin()` is legacy. Any new RLS policies use `is_super_admin()`. Don't refactor existing policies unless asked.

### 5. Widget template literal escaping

The widget is generated by `supabase/functions/widget-loader/index.ts` as a self-contained JavaScript file via a Deno template literal. Inside that template literal:

- All `${variable}` that should resolve at BROWSER runtime must be escaped as `\${variable}` in the Deno source
- Only five things resolve at Deno generation time and are left unescaped: `${config.agentId}`, `${JSON.stringify(config)}`, `${interactUrl}`, `${supabaseUrl}`, `${supabaseAnonKey}`
- Regex patterns need doubled backslashes: `\\[` not `\[`, `\\s` not `\s`, `\\n` not `\n`
- A single wrong escape crashes the entire widget with no obvious error — the FAB just silently fails to appear

When touching `widget-loader/index.ts`, always verify the live widget still loads after the change by asking Silv to test.

### 6. Route guards must NOT wait for `impersonationLoading`

Route guards (`AdminProtectedRoute`, `AgencyProtectedRoute`, `ProtectedRoute`) check bridge values in sessionStorage synchronously. If they wait for async impersonation data they cause white-screen bugs. This has happened before.

### 7. Navigation uses `window.location.href`

All route boundary crossings (admin → agency → client) use `window.location.href` (full page reload) so all hooks reinitialise from sessionStorage. Don't use `navigate()` for cross-boundary routing. Exception: `DevSwitch` uses `navigate()` for Lovable-era preview compatibility — it'll be removed before HeyB migration.

### 8. DevSwitch stays for now

`src/components/DevSwitch.tsx` — the purple ⚡ button bottom-right (super admin only) — stays until explicitly removed pre-HeyB-migration. Don't remove it automatically even if it looks like dev-only code.

### 9. Denormalise for list views

Data shown on list cards (owner name, message count, department name) should live as denormalised columns on the parent table, updated by triggers or Edge Functions. Don't do per-card joins/subqueries — they get slow at scale. Pattern: add column, set in Edge Function, backfill with SQL migration, frontend reads via `select('*')`.

### 10. Widget-file-upload upload-on-send pattern

`widget-file-upload` Edge Function is now a combined upload + Voiceflow + transcript insert. If the upload succeeds but a downstream step fails, the function deletes the storage object before returning an error. There are no orphan files. Same pattern for `agent-file-upload` (JWT-authenticated version for agents sending to customers). Do not split upload from send.

## Where things live

### Edge Functions (`supabase/functions/`)

| Function | Purpose |
|---|---|
| `widget-loader` | Generates the self-contained widget JavaScript. Largest file (~2290 lines). |
| `voiceflow-interact` | Voiceflow proxy, transcript writes, handover routing |
| `widget-file-upload` | Atomic upload + send for customer-side attachments |
| `agent-file-upload` | Atomic upload + send for agent-side attachments (JWT-auth) |
| `handover-actions` | Accept, end, transfer, takeover, send message, resolve |
| `handover-timer` | Periodic timeout checks |

### Frontend (`src/`)

Standard React + Vite project. Notable files:

| File | Lines | Purpose |
|---|---|---|
| `pages/client/Conversations.tsx` | ~2200 | Three-panel conversations page (biggest monolith) |
| `components/client-management/ClientUsersManagement.tsx` | ~1700 | User / department / role admin |
| `hooks/useMultiTenantAuth.tsx` | ~587 | Auth, user type detection, preview mode bridge |
| `hooks/useImpersonation.tsx` | ~507 | Impersonation session management |
| `hooks/useClientAgentContext.tsx` | ~669 | Permission resolution, agent list |

Both large files (`Conversations.tsx`, `ClientUsersManagement.tsx`) are candidates for splitting into sub-components. Don't split them unless explicitly asked — they work correctly as-is.

### Reference specs

Silv keeps specs and design docs in the project-knowledge folder of his chat app with planning Claude. He pastes the relevant spec into you when giving you a task. Don't expect specs to live in the repo — they may be copy-pasted ad-hoc into prompts.

## Useful commands

```bash
# Install deps (first time only)
npm install

# Run the frontend dev server
npm run dev

# Deploy all Edge Functions (rarely needed — GitHub Actions auto-deploys on push)
supabase functions deploy

# Deploy a single function
supabase functions deploy widget-loader

# Run Supabase migrations (if any are pending)
supabase db push

# Tail Edge Function logs (useful when debugging)
supabase functions logs widget-loader --tail
```

## Output style when talking to Silv

Silv prefers:
- **Plain language first.** Explain what a change does before getting technical.
- **Short responses.** Don't over-explain. If Silv wants more detail he'll ask.
- **No emoji.** No fluff. No "great question!" preambles.
- **Direct pushback.** If a request is technically wrong, say so. Don't just comply.
- **Test steps.** After shipping a change, tell Silv what to test and how: "Hard-refresh the embedded widget page. Click FAB. Open a new chat. You should see X."
