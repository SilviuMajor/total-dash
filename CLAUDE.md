# CLAUDE.md — TotalDash

> Read this file at the start of every session before doing any work. It's the working manual for Claude Code on this project.

## What this is

TotalDash is a multi-tenant SaaS customer-service dashboard for AI chatbot agents (Voiceflow/Retell). Production at `https://app.total-dash.com`. Built by Silv, owner of Fiveleaf (UK agency). The immediate priority is migrating the first client (HeyB) from a third-party platform onto TotalDash. Platform must be production-ready and bug-free before that migration.

## Tech stack

- **Frontend:** React + Vite + TypeScript + Tailwind + shadcn/ui (`src/`)
- **Hosting:** Vercel (auto-deploy on push to `main`)
- **Backend:** Supabase — Postgres, Auth, Edge Functions, RLS, Realtime (`supabase/`)
- **Live Supabase project ref:** `nznfznjlroycddegwvpt` (note: `supabase/config.toml` is intentionally pinned to the old ref — do not change it; see Critical rule 11)
- **Edge Function deploys:** GitHub Actions on push to `main`, only redeploys functions whose files changed (`.github/workflows/deploy-supabase-functions.yml`)
- **No staging environment** yet (will add Supabase branching when HeyB migrates).

## Working with Silv

Silv is the only person editing this codebase. He's a product/business operator who builds, not a developer by trade.
- Don't assume he knows Terminal conventions, Node/npm internals, Git semantics, shell escaping, or hidden-file gotchas. Explain when introducing something he hasn't seen.
- He flows fast. The worst thing you can do is break his flow with avoidable knowledge gaps or surprise bugs. Anticipate failure modes; lead with "here's what'll bite" rather than discovering it together.
- "Done" from Silv often means "I did the thing in some way." Verify what was actually done before assuming next steps.
- He occasionally pastes anon keys / public-ish secrets in chat. Redact in any output you produce; don't echo back. Service-role keys or third-party API keys (Anthropic, Resend, Stripe) are rotation-grade — flag immediately if exposed.
- Skip explanations aimed at future contributors — there are none.
- Don't add defensive commentary in commits.

### Two Claudes

1. **Planning Claude (web/mac chat)** — strategy, specs, brainstorms, architecture, project memory. Silv goes here first to figure out *what* to do.
2. **You — Claude Code** — read/edit files, deploy, diagnose live. Silv pastes specs from the planning Claude into you. Treat them as authoritative — don't re-litigate decided design.

Silv keeps broader architecture docs in the planning-Claude project knowledge (`TotalDash-Conversations-Architecture.md`, `TotalDash-Permission-System-Spec.md`, etc.). If something feels missing, ask.

## Workflow defaults

**Commit and push.** After any meaningful change, commit and push to `main` automatically. Short, descriptive message (e.g. "Fix widget-loader CSS escaping"). Don't ask permission per commit. Do ask if a change seems destructive (deleting large files, dropping schemas, etc.). **Always push** after committing — Silv has been bitten by "committed but didn't push" more than once.

**Auto-deploy.** Pushes to `main` trigger GitHub Actions; only changed Edge Functions redeploy. Vercel auto-deploys frontend. No manual `supabase functions deploy` needed. If a function isn't deploying after a push, check the Actions tab.

**Testing.** Silv tests by hitting the live URL after deploy. The widget embed lives on a Framer page. After shipping, tell Silv explicitly what's deployed and what to hard-refresh (Cmd+Shift+R) to see it.

**When something breaks.** Diagnose before guessing. Read the actual file. Check browser console for JS errors, Supabase logs for Edge Function errors. Don't propose speculative fixes without checking what broke.

**If the first fix fails.** Investigate root cause; try a different angle. Don't defer to "tech debt" unless Silv explicitly agrees it's not worth fixing now.

## Plan mode protocol

Use plan mode (Shift+Tab) by default for anything more complex than a typo fix. When entering plan mode for a feature or fix:
1. Use the Explore subagent to map relevant files before proposing.
2. Ask 1–3 clarifying questions max if there are genuine architectural choices. Skip questions whose answers are already in this file or visible in the repo.
3. Propose a plan with: files to change, what changes, what could go wrong, what verification looks like.
4. Wait for approval before exiting plan mode.
5. After execution: build (if touched), commit clearly, push.

For migration / infra work specifically, halt-and-review between plan and execute is mandatory. For everyday feature work, plan-then-execute in one flow is fine.

## Multi-tenant hierarchy

```
Super Admin (Silv)
  └─ Agencies (Fiveleaf)
      └─ Clients (HeyB)
          └─ Users (client team)
              └─ Agents (AI chatbots)
```

## Auth & login routes

- Super admin login: `/super-admin/login`
- Agency login: `/agency/login` (or `/agencylogin`)
- Client login: `/login/:agencySlug` (e.g. `/login/fiveleaf`), optionally `/login/:agencySlug/:clientSlug`
- Once authenticated, app paths are root-level (`/conversations`, `/settings`, etc.) — no slug prefix inside the app.
- The bare `/:agencySlug` route was **removed** because it collided with app paths. Don't reintroduce it.

## Critical rules

These are painful rules Silv has learned the hard way. Do NOT violate them without explicit agreement.

### 1. Agent config save pattern

The `agents_safe` view strips three API-key fields from `config` JSONB: `api_key`, `voiceflow_api_key`, `retell_api_key`. If you do `config: { ...agent.config, newKey: value }` where `agent.config` came from `agents_safe`, you'll wipe those credentials and break the Voiceflow widget. (Other fields like `project_id` are NOT stripped.)

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

The RPC's access scope is super_admin OR agency_users membership OR client_users assigned to the agent (codified in `20260426000000_codify_update_agent_config_rpc.sql` + `20260426000030_update_agent_config_allow_client_users.sql`).

### 2. Use `agents_safe` view for client-facing queries

Client pages (anything under `src/pages/client/` and `src/components/client-management/`) must select from `agents_safe`, not `agents` directly. The view strips API credentials from `config` so they're never exposed to client users.

### 3. Use `is_super_admin()` in new RLS policies

`is_admin()` is legacy and broader (keys off `profiles.role`, bypasses agency isolation). Any new RLS policies use `is_super_admin()`. Don't refactor existing policies unless asked.

### 4. `isDepartmentOpen` is duplicated

Exists in TWO places:
- `supabase/functions/voiceflow-interact/index.ts` (Edge Function — actual routing)
- `src/components/client-management/DepartmentManagement.tsx` (Frontend — display only)

Any change (e.g. `always_open` bypass) must be applied to both. Diverging copies = the dashboard lying about whether handover will succeed. Tech debt to deduplicate; don't fix opportunistically without surfacing.

### 5. Widget template literal escaping

`supabase/functions/widget-loader/index.ts` generates the self-contained widget via a Deno template literal. Inside that literal:

- `${variable}` that should resolve at BROWSER runtime must be escaped as `\${variable}` in Deno source
- Only five things resolve at Deno generation time and are left unescaped: `${config.agentId}`, `${JSON.stringify(config)}`, `${interactUrl}`, `${supabaseUrl}`, `${supabaseAnonKey}`
- Regex patterns need doubled backslashes: `\\[` not `\[`, `\\s` not `\s`, `\\n` not `\n`
- A single wrong escape crashes the entire widget silently — the FAB just fails to appear

When editing, manually verify by sampling literal output strings, and ask Silv to test the live widget.

### 6. Route guards must NOT wait for `impersonationLoading`

`AdminProtectedRoute`, `AgencyProtectedRoute`, `ProtectedRoute` check sessionStorage bridge values synchronously. If they wait for async impersonation data, white-screen bugs result. Has happened before.

### 7. Navigation uses `window.location.href` across boundaries

All admin ↔ agency ↔ client crossings use `window.location.href` (full page reload) so all hooks reinitialise from sessionStorage. Don't use `navigate()` for cross-boundary routing. SPA navigation across boundaries breaks auth context. Exception: `DevSwitch` uses `navigate()` for Lovable-era preview compatibility — to be removed pre-HeyB.

### 8. DevSwitch stays for now

`src/components/DevSwitch.tsx` — purple ⚡ button bottom-right, super admin only — stays until explicitly removed pre-HeyB. Don't remove automatically even though it looks dev-only.

### 9. Denormalise for list views

Data on list cards (owner name, message count, department name) lives as denormalised columns on the parent table, populated by triggers or Edge Functions. Don't do per-card joins/subqueries — they're slow at scale. Pattern: add column, set in Edge Function, backfill via SQL migration, frontend reads via `select('*')`.

### 10. Widget-file-upload upload-on-send

`widget-file-upload` is a combined upload + Voiceflow + transcript insert. If upload succeeds but a downstream step fails, the function deletes the storage object before returning an error. No orphan files. Same pattern for `agent-file-upload` (JWT-auth, agent → customer). Do not split upload from send.

### 11. Schema changes go through `scripts/migration/apply-migration.mjs`

**Do not** run `supabase db push` or `supabase migration up`. The CLI reads `supabase/config.toml` which is intentionally pinned to the **old** project ref; the runner script targets the live project. To apply a new migration:

```bash
node scripts/migration/apply-migration.mjs supabase/migrations/<file>.sql
```

Do not modify `supabase/config.toml`.

### 12. Postgres triggers on managed Supabase

Use `DISABLE TRIGGER USER`, not `DISABLE TRIGGER ALL`. The managed role can't touch system triggers (`RI_ConstraintTrigger_*`), so `ALL` errors out.

### 13. pg_cron job bodies inline anon keys directly

Managed Supabase rejects `ALTER DATABASE ... SET app.settings.*`. Inline the anon key into the SQL inside the `cron.schedule` call. Do not commit service-role keys this way — anon only, since it's executed at runtime but never committed (use placeholders if the SQL is checked into the repo, or apply via the runner without committing the literal).

## Where things live

### Edge Functions (`supabase/functions/`)

| Function | Purpose |
|---|---|
| `widget-loader` | Generates the self-contained widget JavaScript. Largest file (~2290 lines). |
| `voiceflow-interact` | Voiceflow proxy, transcript writes, handover routing. Anonymous, rate-limited. |
| `widget-file-upload` | Atomic upload + send for customer-side attachments (anonymous). |
| `agent-file-upload` | Atomic upload + send for agent-side attachments (JWT-auth). |
| `handover-actions` | Accept, end, transfer, takeover, send message, resolve. |
| `handover-timer` | Periodic timeout checks. |
| `check-domain-context` | Whitelabel + slug routing resolver (cached 5 min). |
| `duplicate-agent` | Clones an agent and its workflows/specs/integrations. |

`widget-loader`, `widget-file-upload`, `voiceflow-interact` are intentionally unauthenticated (called by anonymous widget users). They must validate input rigorously and rate-limit by IP/agent. All other functions verify JWT.

Functions imported from `esm.sh` have failed deploys when esm.sh is flaky. Migrating active functions to `jsr:` imports (e.g. `jsr:@supabase/supabase-js@2`) is gradual tech debt — do it when touching a function for other reasons, not as a bulk migration.

### Frontend (`src/`)

| File | Lines | Purpose |
|---|---|---|
| `pages/client/Conversations.tsx` | ~2550 | Three-panel conversations page (biggest monolith) |
| `components/client-management/ClientUsersManagement.tsx` | ~1850 | User / department / role admin |
| `hooks/useMultiTenantAuth.tsx` | ~600 | Auth, user type detection, preview-mode bridge |
| `hooks/useImpersonation.tsx` | ~487 | Impersonation session management |
| `hooks/useClientAgentContext.tsx` | ~673 | Permission resolution, agent list |

Both large pages and the three large hooks are overdue for splitting. Don't refactor opportunistically without surfacing the scope first.

## Useful commands

```bash
# Install deps (first time only)
npm install

# Frontend dev server
npm run dev

# Production build (must pass before any push)
npm run build

# Apply a new migration to the live project
node scripts/migration/apply-migration.mjs supabase/migrations/<file>.sql

# Tail Edge Function logs (debugging)
supabase functions logs widget-loader --tail
```

## Don'ts

- Don't run `supabase db push` or `supabase migration up`.
- Don't modify `supabase/config.toml`.
- Don't reintroduce the bare `/:agencySlug` route in `App.tsx`.
- Don't commit secrets. Anon keys may be inlined in pg_cron SQL applied via the runner, but never committed verbatim — use placeholders in committed files.
- Don't use `is_admin()` in new RLS policies.
- Don't query `agents` directly from client-facing pages.
- Don't spread `agent.config` from `agents_safe` (use `update_agent_config` RPC).
- Don't use `navigate()` to cross admin ↔ agency ↔ client boundaries.

## Output style when talking to Silv

- **Plain language first.** Explain what a change does before getting technical.
- **Short responses.** Don't over-explain. If Silv wants more detail he'll ask.
- **No emoji. No fluff. No "great question!" preambles.**
- **Direct pushback.** If a request is technically wrong, say so. Don't just comply.
- **Test steps.** After shipping: "Hard-refresh the embedded widget page. Click FAB. Open a new chat. You should see X."
