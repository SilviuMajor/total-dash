# TotalDash — Backlog

> Last revised: 26 April 2026
> Purpose: living document. Single source of truth for everything outstanding.
> Workflow: pick an item, open a fresh Claude Code session, paste the entry into plan mode, work through clarifications, execute. Mark items done with date + commit hash; don't delete.

This replaces the old per-feature spec docs as the working unit. The original spec files in project knowledge stay as **reference material** when an item has detailed prior thinking — entries below link to them. Open questions and decisions captured in those specs are summarised here so plan mode has the context without needing to re-derive it.

Tier 1 = pre-HeyB-stability must-haves. Tier 2 = strong wants. Tier 3 = post-HeyB / parked. Audit findings from 25 April are tracked separately at the bottom.

---

## Instructions for Claude when this command is invoked

When Silv runs `/outstanding`, do the following before anything else:

1. **Identify the next item.** The next item is the topmost still-Open entry in Tier 1, then Tier 2, then Tier 3 (in that order). Skip anything marked Status: Done / Mostly complete / Parked.
2. **Explain it in plain language.** Two short paragraphs, no jargon. Cover:
   - What's broken / missing today, from the user's point of view (what does Silv or a HeyB agent actually see?).
   - What "fixed" looks like — what behaviour changes after the work is done.
   - Why it matters now (link it to HeyB migration readiness if relevant).
   Avoid file paths, function names, and schema details in this section. If a term is unavoidable (e.g. "handover", "Voiceflow"), define it in one sentence.
3. **Walk through the implementation outline.** Use the spec link and the "Touches" / "Decisions already made" lines in the entry. Plain bullets, in execution order. Flag anything still undecided as a question for Silv before coding starts.
4. **Provide test steps timed to the right phase.** Split into three blocks; do not collapse them:
   - **Local pre-deploy checks** — what can be verified before pushing (e.g. `npm run build`, type-check, reading specific log lines, reviewing a generated SQL file). These run in the worktree.
   - **Immediately after deploy** — what to hard-refresh and click in `app.total-dash.com`, in what order, with the exact expected outcome. Include Edge Function log tail commands when a function changed (`supabase functions logs <name> --tail`). Default browser refresh to `Cmd+Shift+R`.
   - **24-hour soak check** — what to watch over the next day to catch races, cron timing bugs, or rare paths. Name the dashboard, log query, or table to inspect, and what "healthy" looks like vs. what "broken" looks like.
5. **Offer to enter plan mode.** End by asking Silv whether he wants to proceed with this item now, swap to a different one, or refine the plain-language explanation first. Do not exit plan mode or start editing files until he confirms.

Tone: same as the rest of CLAUDE.md — plain language, no fluff, no emoji, direct. If something in the entry is stale or contradicts the current code, surface that before walking through the plan.

---

---

## Tier 1 — must-haves

### N8 — Team-wide conversation archive ✅ DONE (2026-04-27)

**Type:** Feature | **Effort:** Medium | **Status:** Shipped
**Spec:** `TotalDash-Spec-N8-Team-Conversation-Archive.md`

Shipped: `is_archived` / `archived_at` / `archived_by` columns + `set_conversation_archived` RPC (super_admin / agency / client admin tier; 42501 vs 42704 split). /conversations always filters archived out; Archive button on the middle-panel header with a confirmation dialog (forces ended_at + status=resolved). Transcripts gains an "Include archived" toggle, faded rows + Archived badge, and an Unarchive button on the detail dialog. Non-admins see the buttons but get a toast on click. No partial index in v1.

---

### N11 — Permission system audit ✅ DONE (2026-04-27)

**Type:** Audit + Bug Hunt | **Effort:** Medium | **Status:** Shipped (audit complete; 16 follow-up bugs filed as N11-F1 through N11-F16 below)
**Spec:** `TotalDash-Spec-N11-Permission-System-Audit.md`
**Report:** `docs/audits/2026-04-N11-permissions-audit.md`

Audit found 16 confirmed bugs (1 Critical, 5 High, 7 Medium, 3 Low) and rejected 2 false alarms (admin_tier does NOT bypass ceilings; agent-scoped pages ARE gated by `ProtectedRoute requiredPage` even though page bodies don't double-check). Each finding is filed as a separate entry below — see the report for full repro and fix sketch on each.

---

### N11-F1 — Role change "Keep current permissions" leaks orphan role_id + drops UI edits ✅ DONE (2026-04-27)

**Type:** Bug (Critical) | **Effort:** Small | **Status:** Shipped

Both modal paths now update `client_user_permissions.role_id` (no more orphan), persist in-memory permission edits when the affected user is the expanded one (no more silently dropped toggles), and surface DB errors via destructive toast instead of always claiming success.

**Touches:** `src/components/client-management/ClientUsersManagement.tsx:1746-1903`.

---

### N11-F2 — Silent failures on every Roles toggle ✅ DONE (2026-04-27)

**Type:** Bug (High) | **Effort:** Small | **Status:** Shipped

`togglePermission` and `toggleClientPermissions` now apply optimistic UI, await the update, roll back on error, and toast destructively. `applyToAllUsers` collects per-agent errors across the loop and surfaces them. No more false "Saved" toasts on RLS or network failures.

**Touches:** `src/components/settings/RolesManagement.tsx`.

---

### N11-F3 — Active sessions don't see role-permission changes until reload

**Type:** Bug (High) | **Effort:** Medium | **Status:** Open

After `RolesManagement` toggles persist to DB, no signal reaches `useClientAgentContext` in active client-user sessions. They keep stale `selectedAgentPermissions` until manual refresh. Likely root cause of the spec's "toggles don't take effect" symptom.

**Decision needed:** Supabase Realtime subscription on `role_permission_templates` + `client_roles`, OR a manual broadcast channel. Realtime is cleaner but may add per-tab subscription overhead.

**Touches:** `src/hooks/useClientAgentContext.tsx`, `src/components/settings/RolesManagement.tsx`.

---

### N11-F4 — Settings Departments sub-tab not gated by its own permission ✅ DONE (2026-04-27)

**Type:** Bug (High) | **Effort:** Tiny | **Status:** Shipped

Departments sub-tab button and content are now gated by `showDepartments`. A `SubTabGuard` helper auto-redirects the active sub-tab to "team" if the user lands on a hidden one (e.g. their permission gets revoked while the page is open).

**Touches:** `src/pages/Settings.tsx`.

---

### N11-F5 — Settings.tsx audit log uses `=== true` while other tabs use `!== false` ✅ DONE (2026-04-27)

**Type:** Bug (High) | **Effort:** Tiny | **Status:** Shipped

Audit Log now uses `!== false` for both Layer-2 ceiling and view permission, matching the other Company Settings tabs. To keep Audit Log default-off, set the capability/permission to `false` explicitly in seeds — no more silent operator drift.

**Touches:** `src/pages/Settings.tsx`.

---

### N11-F6 — RolesManagement rendered without readOnly prop in Settings.tsx (privilege escalation) ✅ DONE (2026-04-27)

**Type:** Bug (High) | **Effort:** Small | **Status:** Shipped

Roles sub-tab is now gated by `canManageTeam` (i.e. `settings_team_manage`) — both the button and the content. View-only users can still see Departments and Users tabs but cannot reach the Roles editor at all. The `SubTabGuard` redirects to Users if the user is on the Roles tab when their manage permission is revoked. Read-only mode for RolesManagement itself was deferred — gating the entry point is the simpler, safer cut.

**Touches:** `src/pages/Settings.tsx`.

---

### N11-F7 — Cross-scope mixing in `resolveClientScoped`

**Type:** Bug (Medium, latent) | **Effort:** Small | **Status:** Open

`useClientAgentContext.tsx:539-544`, `:349-354`, `:654-659` — `resolveClientScoped` uses agent-scoped `hasOverrides` and `userOverrides` JSON to gate client-scoped overrides. Should use `hasClientOverrides` and `userClientOverrides` (the correct path is implemented in `resolveCompanyPerm` at `:489-494`). Latent today because nobody writes `settings_page`/`audit_log` keys into the agent-scoped JSON, but a future write path or manual SQL would silently ride this.

**Touches:** `src/hooks/useClientAgentContext.tsx`. Best fixed alongside F8 + F15.

---

### N11-F8 — Settings link gated by per-agent value instead of canonical client-scoped one

**Type:** Bug (Medium) | **Effort:** Small | **Status:** Open

`Sidebar.tsx:107`, `ProtectedRoute.tsx:60-78`, and `App.tsx:181` (via `requiredPage="settings_page"`) all read `selectedAgentPermissions.settings_page` — produced by the F7-affected resolver. The canonical client-scoped value lives on `companySettingsPermissions.settings_page` (correctly resolved). Same for `audit_log`.

**Touches:** `src/components/Sidebar.tsx:107`, `src/components/ProtectedRoute.tsx`, `src/hooks/useClientAgentContext.tsx` (consider removing `settings_page` and `audit_log` from `AgentPermissions` interface).

---

### N11-F9 — No cache invalidation when agency flips a Layer-2 ceiling

**Type:** Bug (Medium) | **Effort:** Medium | **Status:** Open

`AgencyClientDetails.tsx:66-76` upserts `client_settings.admin_capabilities` with no broadcast. Client users mid-session don't see the change. Same fix family as F3.

**Touches:** `src/pages/agency/AgencyClientDetails.tsx`, `src/hooks/useClientAgentContext.tsx`.

---

### N11-F10 — `loadAgentPermissions` errors swallowed silently

**Type:** Bug (Medium) | **Effort:** Tiny | **Status:** Open

`useClientAgentContext.tsx:593-673` — async function inside useEffect with no try/catch. A failed Supabase query throws into the dropped promise; previous agent's permissions stay in state.

**Touches:** `src/hooks/useClientAgentContext.tsx:593-673`.

---

### N11-F11 — User-level toggles always-clickable when ceiling blocks

**Type:** Bug (Medium) | **Effort:** Small | **Status:** Open

`ClientUsersManagement.tsx` per-user toggles ignore the ceiling. Admin flips a switch, sees "Saved", change has zero effect on resolved permissions because ceiling short-circuits in resolution. `RolesManagement.tsx:148-153` already does this correctly via `getVisiblePermKeys`/`getVisibleCompanyTabs` — apply the same pattern at the user level.

**Touches:** `src/components/client-management/ClientUsersManagement.tsx`.

---

### N11-F12 — New-user agent grant hardcodes `has_overrides: false` even with custom perms

**Type:** Bug (Medium) | **Effort:** Tiny | **Status:** Open

`ClientUsersManagement.tsx:1535-1550` — when granting new agent access, hardcodes `has_overrides: false`. If admin customised perms in the panel, those values get persisted but the flag claims they're not overrides; resolver then ignores them.

**Touches:** `src/components/client-management/ClientUsersManagement.tsx:1535-1550`. Compare against template like the UPDATE path does (`:1516-1518`).

---

### N11-F13 — Client-scoped override flag set by "any keys present" rather than diff vs template

**Type:** Bug (Medium) | **Effort:** Tiny | **Status:** Open

`ClientUsersManagement.tsx:1564-1572` upserts with `has_overrides: Object.keys(selectedUserClientPerms).length > 0`. So a fresh save (no actual changes) flags the user as having overrides, which then makes the "Reset to role defaults" button appear with nothing to reset.

**Touches:** `src/components/client-management/ClientUsersManagement.tsx:1564-1572`. Diff against `roles.find(r => r.id === user.role_id)?.client_permissions`.

---

### N11-F14 — `AgencyAgentDetails` reads `agents` directly instead of `agents_safe`

**Type:** Cleanup (Low) | **Effort:** Tiny | **Status:** Open

`AgencyAgentDetails.tsx:69` reads `agents` directly. Safe today (route is agency-only), but inconsistent with CLAUDE.md rule #2.

**Touches:** `src/pages/agency/AgencyAgentDetails.tsx:69`.

---

### N11-F15 — Resolution functions duplicated 4× in `useClientAgentContext.tsx`

**Type:** Refactor (Low) | **Effort:** Medium | **Status:** Open

`resolveCompanyPerm` and `resolveClientScoped`/`resolvePermission` defined separately in `loadClientAgentsForPreview`, `loadClientAgentsAsUser`, `loadClientAgents`, and the per-agent useEffect. Drift already exists (see F7). Extract once at module scope.

**Touches:** `src/hooks/useClientAgentContext.tsx`. Best done together with F7 + F8.

---

### N11-F16 — RolesManagement "Save" button is a no-op when role has 0 users

**Type:** UX Polish (Low) | **Effort:** Tiny | **Status:** Open

`RolesManagement.tsx:194-201`, `:482`, `:608` — toggles already persist on change. The Save button only triggers the "Apply to all users" modal when `userCounts[roleId] > 0`; otherwise just shows a "Saved" toast. Confusing — admin may think Save is required.

**Touches:** `src/components/settings/RolesManagement.tsx`. Either hide Save when count=0, or change copy to make immediate-save behaviour explicit.

---

### N11-F17 — Permission UI wording is ambiguous about scope

**Type:** UX Polish (Low) | **Effort:** Small | **Status:** Open

Tracked as a single follow-up:
- `RolesManagement.tsx` toggles use raw permission labels — no "Role default" / "All users with this role" indicator
- `ClientUsersManagement.tsx` per-user toggles — no "Override" / "Override for this user only" indicator
- `AgencyClientDetails.tsx` ceiling toggles — no "Agency-wide ceiling" language
- `AgencyAgentDetails.tsx` ceiling toggles — same
- Settings sub-tabs don't visually distinguish "View only" vs "Can edit" mode

**Touches:** label/copy changes across 4 files.

---

### N27 — Create user fails (longstanding)

**Type:** Bug | **Effort:** Small (suspected) | **Status:** Open

Adding a new client user from Settings → Users → "Add User" produces an error toast. Pre-existing — unrelated to N11 follow-up work. Real exposure once HeyB onboarding starts.

**Suspected cause (needs confirmation with the actual error message):** `handleAddUser` in `ClientUsersManagement.tsx:663-686` inserts permission rows from the frontend AFTER `create-client-user/index.ts:306-324` already inserted rows for every assigned agent. If a unique constraint exists on `(user_id, agent_id, client_id)`, the frontend insert hits a duplicate-key error. Two fixes possible:
- Drop the redundant frontend insert and let the EF own all permission writes (simpler).
- Switch frontend to upsert with `onConflict: 'user_id,agent_id,client_id'` and let the EF skip if frontend is sending custom perms.

Frontend insert was added when the EF didn't yet seed permissions; EF behaviour caught up but frontend wasn't deduplicated.

**Repro:** Open Settings → Users → Add User. Fill out the form. Click "Add User". Capture (a) toast text, (b) browser-console error line starting `[ClientUsersManagement] User creation failed:`, (c) Network tab response body for the `create-client-user` POST.

**Touches:** `src/components/client-management/ClientUsersManagement.tsx:641-712`, `supabase/functions/create-client-user/index.ts` (only if the EF path also has a bug).

---

### N28 — User-settings dialog width + Settings page density

**Type:** UX Polish | **Effort:** Tiny | **Status:** Open

Two small layout issues on Settings → Users:

1. **User-settings overlay/dialog is too narrow.** When expanding a user (or opening the settings overlay for one), the menu doesn't have enough horizontal room — content feels cramped. Widen the dialog max-width.
2. **Settings page padding is excessive.** `Settings.tsx` wraps everything in `p-6 space-y-6`, plus child cards add their own `p-6`. Reduce wrapper padding (or child padding) where it doesn't compromise breathing room. Especially noticeable on the Users sub-tab where dense permission tables get squeezed sideways while top/bottom whitespace eats vertical real estate.

**Touches:** `src/pages/Settings.tsx` (page-level `p-6`), `src/components/client-management/ClientUsersManagement.tsx` (user dialog/overlay max-width — search `Dialog` / `DialogContent` / `max-w-`).

---

### N20 — Production deployment planning

**Type:** Infrastructure | **Effort:** Was Large; mostly DONE | **Status:** Mostly complete (revisit residuals)
**Spec:** `TotalDash-Spec-N20-Production-Deployment-Planning.md`

Originally written before cutover. As of 26 April, the major work is done: Vercel deployment live at `app.total-dash.com`, GitHub Actions deploy pipeline configured, DNS migrated to Squarespace CNAME → Vercel. Remaining residuals from spec:

- **`lovable-tagger` devDependency cleanup** — still in `package.json`, not removed yet.
- **Whitelabel custom domain support** — separate item (see "Future" tier).
- **Old Lovable project deletion** — pending stability window (~7 days from cutover).

**Touches:** `package.json` (small), eventual Lovable account cancellation.

---

### Audit findings — Critical tier (currently being executed by Claude Code)

These came out of the 25 April audit. Claude Code is working through them.

- **C1** — `update_agent_config` RPC has no migration. Codify the live function as a migration so a rebuild doesn't silently revert behaviour.
- **C2** — `agents_safe` view uses `security_invoker = true`. Switch to `security_invoker = false` (DEFINER) so the view always strips API keys regardless of caller RLS.
- **C3** — Legacy `is_admin()` in `text_transcripts` policy. Replace with `is_super_admin()` + agency_users membership check.

**Status:** in flight as a single Claude Code execution. Mark this section complete when Claude Code reports back with all three landed.

---

## Tier 2 — strong wants

### N1 — My Conversations filter

**Type:** Enhancement | **Effort:** Small (1-2 days) | **Status:** Open
**Spec:** `TotalDash-Spec-N1-My-Conversations-Filter.md`

Toggle in Conversations.tsx toolbar to filter list to only conversations where current user is owner. AND-logic with existing status/tag/sort filters. Reuses existing `isMine` check (`conv.owner_id === currentClientUserId`, line 1181).

**Touches:** `Conversations.tsx` lines ~999-1020 (toolbar), `myConversationsOnly` state, filter dependency array (line 189).

---

### N2 — Per-conversation message counts in right panel

**Type:** Enhancement | **Effort:** Small | **Status:** Open
**Spec:** `TotalDash-Spec-N2-Per-Conversation-Message-Counts.md`

Show count of customer / AI-or-agent / system messages in the right panel of selected conversation, between Contact Info and Previous Conversations sections. Phase 1 client-side (count from loaded transcripts). Phase 2 (later) denormalise to a `message_count_*` column on `conversations` populated by trigger.

**Touches:** `Conversations.tsx` right panel (lines ~1882-2062), `MetricCard` component reuse.

---

### N3 — Waiting timer on `waiting` status

**Type:** Enhancement | **Effort:** Small (~2h) | **Status:** Open
**Spec:** `TotalDash-Spec-N3-Waiting-Timer.md`

Show clock pill (same colour-coded design as `in_handover`) on conversations with `waiting` status. Data already exists — `pendingConversationIds` Map already stores `handover_sessions.created_at` per conversation_id. Two-line change to the existing clock-pill conditional.

**Touches:** `Conversations.tsx` lines 1299-1327. No DB changes, no new hooks.

---

### N4 — Date separators in transcript

**Type:** UI Enhancement | **Effort:** Small (~2.5h) | **Status:** Open
**Spec:** `TotalDash-Spec-N4-Date-Separators-Transcript.md`

Insert "Today" / "Yesterday" / day-of-week / full date separators between transcript messages from different calendar days. Styled like existing system messages (centered pill). Uses `date-fns` (already imported).

**Touches:** `Conversations.tsx` lines 1395-1450 (transcript map). Add two helper functions, update JSX.

---

### N7 — End Handover button styling

**Type:** UI Polish | **Effort:** Small | **Status:** Open
**Spec:** `TotalDash-Spec-N7-End-Handover-Button-Styling.md`

"End Handover" button is currently `variant="outline"`, identical to adjacent "Transfer". Doesn't signal its destructive/branching nature (clicking opens a dialog with End-and-Aftercare vs End-and-Resolve). Three styling options in spec; recommended Option A (elevated destructive variant — keeps prominence but distinct from Transfer).

**Touches:** `Conversations.tsx` lines 1763-1772.

**Open question:** which shadcn variant? Needs design call.

---

### N9 — Search overhaul

**Type:** Enhancement | **Effort:** Large (5-7 days) | **Status:** Open
**Spec:** `TotalDash-Spec-N9-Search-Overhaul.md`

Full-text search across transcript content, customer metadata, conversation properties. No real text search exists today (only status/tag filter). Two-phase architecture in spec:
- **Phase 1 (MVP):** client-side search on already-loaded conversations — customer name, phone, email. Fast to ship.
- **Phase 2:** server-side full-text via Postgres `tsvector` index on transcripts + RPC. Production-grade.

**Decisions already made:**
- Approach B+A hybrid: ship Phase 1, then Phase 2.
- Debounce 300-500ms, pagination, target <200ms search latency in Phase 2.

**Open questions:**
- Field-specific operators (`from:John`, `department:Sales`) — in scope or later?
- Fuzzy matching (typo tolerance) — Phase 2 or future?

**Touches:** `Conversations.tsx` toolbar, new `useConversationSearch` hook, eventual SQL migration for tsvector + GIN index, new `search_conversations` RPC.

---

### N10 — Filter overlay + toolbar toggle setting

**Type:** Enhancement | **Effort:** Medium | **Status:** Open
**Spec:** `TotalDash-Spec-N10-Filter-Overlay-Toolbar-Toggle-Setting.md`

Two related changes:
1. User-level setting to hide/show the always-visible filter toolbar (status chips, tag chips, sort dropdown). For users who prefer cleaner header.
2. Always-available filter overlay modal accessed via a Filter button. Consolidates ALL filters (status, tags, departments, date range, customer name, my-conversations from N1, optional message-count range) in one place. Has Apply/Clear/Cancel.

**Touches:** `Conversations.tsx` toolbar, new modal component, user preference store.

---

### N12 — Smart login redirect

**Type:** Auth Enhancement | **Effort:** Small | **Status:** Open
**Spec:** `TotalDash-Spec-N12-Smart-Login-Redirect.md`

If a user logs in on the wrong portal (e.g. super admin signs in at `/agency/login`, or client at `/super-admin/login`), detect mismatch after auth and redirect to correct page with toast "Redirecting to your dashboard."

**Decisions already made:**
- Hybrid approach: extract `detectUserTypeAfterAuth` utility into `src/lib/auth.ts`, call from each login page after sign-in success. Toast/redirect logic stays in each page so styling matches.
- Priority order if user has multiple roles: super_admin > agency > client.
- Skip if in preview mode or impersonating.

**Open question:** does post-cutover slug routing change anything here? Worth re-checking before implementation — today's `/login/:agencySlug` work might have already addressed parts of this.

**Touches:** `Auth.tsx`, `AdminLogin.tsx`, `AgencyLogin.tsx`, new utility in `src/lib/auth.ts`.

---

### N13 — Display login URLs for clients and agencies

**Type:** Agency UX | **Effort:** Small | **Status:** Open
**Spec:** `TotalDash-Spec-N13-Display-Login-URLs.md`

Show agency's own login URL in agency settings, and client login URLs in `AgencyClientDetails`. Copyable read-only input field with "Copy" button + toast confirmation.

**Decisions already made:**
- Use absolute URLs (`https://app.total-dash.com/login/:slug`) for sharing.
- All clients of an agency share the same agency-slug URL (no per-client slugs in MVP).
- Build new `LoginURLDisplay` component reusable across pages.

**Note:** post-cutover URL changed from `/:agencySlug` to `/login/:agencySlug` — spec text needs updating to reflect this when implemented.

**Touches:** new `LoginURLDisplay` component, `AgencyClientDetails`, `AgencySettings`.

---

### N19 — Agent Config + Client Access page merge

**Type:** Agency UX | **Effort:** Medium | **Status:** Open
**Spec:** `TotalDash-Spec-N19-Agent-Config-Client-Access-Merge.md`

`AgencyAgentDetails` currently has "Client Access" as a separate tab from agent config. Mix of agency-only vs client-visible settings is unclear elsewhere too. Merge "Client Access" into a renamed "Configuration & Permissions" tab with explicit section dividers between agency-only config and client-visibility toggles.

**Decisions already made:**
- Recommended Option 2 (merge into Config) over Option 1 (just relabel) or Option 3 (full new permissions UI).
- New tab name: "Configuration & Permissions".
- Section ordering: Configuration first, Permissions second.
- Horizontal-rule divider between sections.

**Open questions:**
- Should we add interaction-level permissions in future ("client can edit widget", etc.)? Affects data model. Answer before finalising.
- Default tab on page load: keep current default or switch to merged tab?

**Touches:** `AgencyAgentDetails.tsx` (tabs structure + Client Access content).

---

## Tier 3 — parked / post-stability

### N14 — White-label password reset emails

**Type:** Feature | **Effort:** Medium | **Status:** Parked
**Spec referenced in:** N15 spec preamble

Post-handover password reset emails currently use a default TotalDash sender / template. Goal: agencies configure their own sender domain and email template, with their branding. Tied closely to N15 / N16 / N17 in concept.

**Touches:** `agency_settings` schema additions, `send-password-reset-email`, possibly Resend domain config per agency.

---

### N15 — Email notifications for handover

**Type:** Notifications | **Effort:** Medium | **Status:** Parked
**Spec:** `TotalDash-Spec-N15-Email-Notifications-Handover.md`

When handovers are requested, accepted, taken over, or transferred, send email notifications to the relevant parties. Respects per-user `client_user_departments.notifications_enabled` preference.

**Decisions already made:**
- 3 templates: `handover_request`, `handover_accepted`, `transfer_completed`.
- Token-based one-click accept link (`handover_notification_tokens` table, 7-day expiry).
- Email respects agency branding from N14.
- Recipient logic: `accept_handover` → emails original requester; `take_over` → emails previous owner; `transfer` → emails both old and new owner.

**Open questions:**
- Department-targeted handovers — email all members? Only managers? Configurable?
- Reminder emails if not accepted within 4h — Phase 1 or Phase 2?

**Touches:** `handover-actions`, new `handover_notification_tokens` table, email templates, settings UI for preferences.

---

### N16 — Microsoft Teams notifications

**Type:** Integration | **Effort:** Large | **Status:** Parked (post-N15)
**Spec:** `TotalDash-Spec-N16-Microsoft-Teams-Notifications.md`

Same trigger surface as N15 (handover events) but delivered to Microsoft Teams via Adaptive Cards with one-click action buttons.

**Decisions already made:**
- Phase 1 = Incoming Webhook approach (simpler, faster). Phase 2 = Bot App if richer interactions needed.
- Per-agency webhook URL stored encrypted in `agency_settings`.
- Per-user opt-out per department.
- New `notification_log` table for delivery tracking.

**Open questions:**
- Channel vs DM? Both? Configurable per agency?
- One-click action button — link out to TotalDash with token, or true Teams Action.Execute (more complex)?

**Dependencies:** depends on N15 patterns being in place first.

**Touches:** new `send-teams-notification` and `teams-action-handler` Edge Functions, `agency_settings` schema, `notification_log` table, settings UI.

---

### N17 — WhatsApp integration

**Type:** Integration | **Effort:** XL | **Status:** Parked (largest remaining feature)
**Spec:** `TotalDash-Spec-N17-WhatsApp-Integration.md`

Add WhatsApp as a second conversation channel alongside the web widget. Customers chat via WhatsApp; agents see conversations in the dashboard with a WhatsApp platform indicator. Bridges through Voiceflow's WhatsApp capability.

**Status: discovery-stage.** Spec is brief by design — the largest item on the backlog and needs significant design before implementation.

**Touches:** new schema (channel/platform column on conversations, possibly new tables), Voiceflow WhatsApp config, agency_settings additions for WhatsApp business credentials, conversation card UI for platform indicator, filtering by platform.

---

### N18 — Duplicate agents and companies

**Type:** Agency UX | **Effort:** Medium | **Status:** Parked
**Spec:** `TotalDash-Spec-N18-Duplicate-Agents-Companies.md`

Clone an existing agent or client/company as a template. Copies configuration, departments, knowledge base, instructions. Excludes conversation history and analytics. Modal prompts for new name and customisations.

**Decisions already made:**
- New Edge Functions: `duplicate-agent`, `duplicate-client`.
- Agent duplication: optional reset of API keys (recommended for security).
- Client duplication: optional copy of team members (default off).
- Don't create new auth users when copying team members; link existing users to new client.

**Open questions:**
- Voiceflow user creation when duplicating agent — new user or share?
- Bulk duplication — Phase 2 or never?

**Touches:** two new Edge Functions, agent and client management UIs, audit log.

---

### N21 — Rename "Previous Handover" to "Handover Sessions"

**Type:** UI Polish | **Effort:** Tiny | **Status:** Open
**Spec:** `TotalDash-Spec-N21-Rename-Previous-Handover.md`

One-line text change in `Conversations.tsx` line 1958. Renames the right-panel section heading from "Previous Conversations" to "Handover Sessions" for terminology consistency.

**Touches:** `Conversations.tsx` line 1958.

---

### N22 — Previous Conversations expand button + date-before-status

**Type:** UI Polish | **Effort:** Small (1-2h) | **Status:** Open
**Spec:** `TotalDash-Spec-N22-Previous-Conversations-Expand-Date.md`

Two related improvements to the right-panel previous-conversations list:
1. Explicit chevron expand button (currently full-row click expands AND selects — ambiguous affordance).
2. Reorder row fields to show date first, then status (left-to-right reading order matches "when + what" question).

**Touches:** `Conversations.tsx` lines 1937-1999.

---

### N23 — Dashboard button selected-state clarity

**Type:** UI Polish | **Effort:** Small (1-2h) | **Status:** Open
**Spec:** `TotalDash-Spec-N23-Button-Selected-State-Clarity.md`

Status filter buttons, tag buttons, and filter chips across the Conversations page have insufficient visual differentiation between selected and unselected states. Three options in spec; recommended Option B (moderate enhancement — subtle border/shadow + slightly stronger background).

**Touches:** Status filter chips, tag chips, filter rows in `Conversations.tsx`.

---

### N24 — In-app messaging between agencies and clients

**Type:** Feature (Major) | **Effort:** Large (4-6 weeks) | **Status:** Parked
**Spec:** `TotalDash-Spec-N24-In-App-Messaging.md`

Internal messaging inbox for cross-tenant communication: super admin ↔ agency admin, agency admin ↔ client users. Threaded conversations, @mentions, link previews to dashboard items, email digest, sidebar inbox with unread badge.

**3-phase rollout in spec:**
- Phase 1 MVP: 1:1 threading, plain text, in-app inbox, basic email digest.
- Phase 2: rich text + mentions + link cards.
- Phase 3: group threads, advanced notifications, audit capabilities.

**Open questions (10 in spec):**
- Scope of who-can-message-whom.
- File attachment support.
- Group threads in Phase 1 or later?
- Super admin audit capabilities.

**Touches:** new schema (threads, messages, participants, mentions), new Edge Functions, sidebar inbox component, email digest cron.

---

### N25 — Login redirect bug after sign-in

**Type:** Bug | **Effort:** Small-Medium | **Status:** Open — verify post-cutover
**Spec:** `TotalDash-Spec-N25-Login-Redirect-Bug.md`

After successful sign-in on `Auth.tsx` (client), success toast shows but user remains on login page. Workaround is manual refresh. Root cause: race condition — `signIn` returns success, but auth state hook updates async, and the `useEffect`-based redirect runs against stale `user` state and bails out.

**Decisions already made:**
- Recommended Option A: explicit `navigate()` after sign-in success (matching `AdminLogin.tsx` pattern, which already works).
- Option B (effect safety net) as fallback if races persist.

**Action:** verify whether the post-cutover routing changes have already addressed this. Test before reopening the spec.

**Touches:** `Auth.tsx` `handleSubmit` after `signIn` success.

---

### N26 — Toast audit and reduction

**Type:** UI Polish | **Effort:** Small-Medium (3-5h) | **Status:** Open
**Spec:** `TotalDash-Spec-N26-Toast-Audit-Reduction.md`

242 `toast()` calls across 10+ files cause alert fatigue. Categorise as Essential vs Informational. Estimated 15-20 redundant toasts removable. Form-validation toasts replaceable with inline field errors.

**Decisions already made:**
- Audit framework in spec (P1 Quick Wins, P2 Form Validation, P3 Consolidation, P4 Error Quality).
- Specific files most affected: `Conversations.tsx` (4-5 removable), `Transcripts.tsx` (2-3), `KnowledgeBase.tsx` (2-3 replaceable), `Auth/ChangePassword` (2-3 replaceable), admin pages (3-4 per page consolidatable).

**Includes the password-reset toast bug noticed during cutover** ("missing email or password" error firing alongside success toast — likely a P2 form-validation issue).

**Touches:** broad — 10+ files. Single execution preferred to maintain consistency.

---

### Attachments Phase 2 — Widget UI for file uploads

**Type:** Feature | **Effort:** Large | **Status:** Paused mid-Phase-2
**Spec:** `TotalDash-Spec-17-Attachments.md`, state in `TotalDash-Spec-17-Phase2-State.md`

Phase 1 (backend) shipped before cutover. Phase 2 (widget UI) is paused. Resuming requires:
- **Step B** — state additions + paperclip flow (pendingAttachment state, XHR upload with progress, cancel handling, drag-and-drop).
- **Step C** — `renderMessages` updated to render `attachments[0]` based on kind (image/video/audio/file). Lightbox for images is Phase 3; widget v1 opens new tab.
- **Step D** — input bar `<input type="file">` accept allowlist matches Edge Function server-side allowlist.
- **Step E** — chat history preview derives from `attachments[0]` when text empty (📷/🎥/🎤/📎 emoji prefix format).
- **Step F** — push (auto-deploys via GitHub Actions).
- **Step G** — flip `fileUploadEnabled` toggle in agent settings for HeyB test agent (`415f07ba-ebb3-4867-bb9f-3207b9994bd0`).

**Lessons learned and locked in (from Phase 1):**
- Upload-on-send pattern (not upload-on-pick). No orphans.
- `widget-file-upload` is atomic combined upload+send. `agent-file-upload` is JWT-auth'd version for agency side.
- Template literal escaping in `widget-loader` — every `${}` referencing browser-runtime variables must be `\${}`. Single mistake silently kills the widget.
- `agent-file-upload` uses `jsr:@supabase/supabase-js@2`, not esm.sh.

**Step A (CSS) was applied** before pause — verify it's still working before resuming Step B.

**Phases 3-5 of attachments spec** (central attachments tab in right panel, lightbox, advanced search/filter on attachments) — separate items, can wait until Phase 2 is shipped.

---

### Phase 6 — Client / agency UX

These are from the original phased roadmap, not the N-spec batch. Most still relevant.

- **#15 — Client logo in sidebar** — Logo upload + 2x2 grid display in client switcher.
- **#47 — User search** — Search/filter on Users tab by name/email/role/department.
- **#46 — Permission warning modal** — Confirmation when disabling features that affect users; show who's affected.
- **#27/#40 — Analytics redesign** — Full rethink. Needs mockups before any implementation. XL effort.

---

### Phase 7 — Data + compliance

- **#26/#45 — Data residency + GDPR** — Region selection, right-to-deletion, data export, retention policies. XL. Becomes more important as you scale beyond HeyB.

---

### Post-stability roadmap (parked even longer)

- **#41** — Transcript archival + retention. Three-tier lifecycle (Active → Archived → Auto-purge).
- **#1** — Agency dashboard redesign. Needs mockups.
- **#2** — Super admin redesign. Needs mockups.
- **#11** — Agency client view condensing. Needs mockups.
- **#9** — Widget competitive audit. Research Intercom, Drift, Tidio, Crisp, Freshchat.
- **#6** — Referral system. Referral links, revenue tracking, payout dashboard.
- **#14** — Guides permissions (agency-controllable). Needs more product thought.
- **Whitelabel custom domains** — per-agency domain (e.g. `support.fiveleaf.co.uk`) via Cloudflare Worker. Schema fields exist (`custom_domain`, `whitelabel_*`); inbound parser stub in `check-domain-context` updated for `/login/` prefix during cutover. Activation needs Cloudflare worker setup, agency-side domain config UI, verification flow.
- **Marketing site at `total-dash.com`** — root domain currently free for this. Could be Squarespace, could be custom built with Claude Code.

---

## Tier 2 audit findings — important but not critical

These came out of the 25 April audit. Lower priority than C1-C3 but should land before HeyB scales beyond a single client.

- **I1** — `voiceflow-interact` accepts arbitrary `agentId`/`userId` without rate limiting or active-agent check. Add validation + per-IP rate limit.
- **I2** — Unwrapped `JSON.parse` in `voiceflow-interact`. Wrap in try/catch, return 400 not 500 on malformed input.
- **I3** — Conversation status mutation can orphan if transcript insert fails. Reorder operations or wrap in Postgres function.
- **I4** — `useMultiTenantAuth.tsx:224` uses `navigate()` for cross-boundary entry. Replace with `window.location.href`.
- **I5** — `AgentSpecs.tsx:64` and `Guides.tsx:55` query `agents` directly instead of `agents_safe`. Standardise.
- **I6** — Unhandled promise rejections in `Conversations.tsx` (`loadClientUser`, `loadPendingIds`). Add toast + retry.
- **I7** — Voiceflow `versionID` hardcoded to `"production"` in `voiceflow-interact`. Add to agent config.

**Status:** in flight as part of the same Claude Code execution as C1-C3.

---

## Tier 3 audit findings — minor cleanup

Low priority. Do opportunistically when touching related code.

- **M1** — `isDepartmentOpen` duplicated. Add cross-pointing comments; deduplicate when convenient.
- **M2** — Race condition in `duplicate-agent` between name-check and insert. Low impact.
- **M3** — Use `.eq()` chaining instead of string-interpolated `.or()` in `check-domain-context`.
- **M4** — In-memory cache in `check-domain-context` only GCs above 1000 entries. Add periodic cleanup.
- **M5** — GitHub Actions deploys all functions every push. Wasteful, not broken. Detect changed functions.
- **M6** — `update_agency_subscription_usage()` trigger fires on every UPDATE. Add `WHEN NEW.agency_id IS DISTINCT FROM OLD.agency_id`.
- **M7** — TypeScript `strictNullChecks: false`, `noImplicitAny: false`. Project choice — flagging only.
- **M8** — Stale closure on `activeSession` in `useImpersonation.tsx:207`. Affects event dispatch only.

---

## Known tech debt (carried from old project prompt)

- 21 files read preview variables via bridge. Migrate to `useImpersonation`.
- `user_roles` table still written by Edge Functions. Legacy.
- `useMultiTenantAuth.tsx` ~587 lines, `ClientUsersManagement.tsx` ~1700 lines, `Conversations.tsx` ~2200 lines — split when convenient.
- DevSwitch must be removed before broader rollout (incl. `dev_switch_active` sessionStorage).
- `client_users.department_id` legacy — junction table `client_user_departments` is source of truth.
- `openai_api_key` column on `agency_settings` dead.
- widget-loader ~2290 lines. Consider splitting CSS into helper.
- Dead config fields in widget-loader still passed but unused: `title`, `description`, `brandingUrl`, `secondaryColor`, `textColor`, `backgroundImageUrl`, `fontSize`, `messageBubbleStyle`, `interactiveButtonStyle`, `messageTextColor`, `messageBgColor`.
- Notification sound toggle exists in widget settings UI but no sound implemented.

---

## Completed (recent)

Date-stamped log of items shipped. Don't delete — provides commit-trail context for future work.

**Completed:** 2026-04-27 — N11 follow-ups F1, F2, F4, F5, F6 landed in one pass. F1: both role-change modal paths now sync `client_user_permissions.role_id`, persist in-memory permission edits when the affected user is expanded, and surface DB errors. F2: optimistic-with-rollback + destructive toasts on RolesManagement saves. F4: Departments sub-tab gated by `showDepartments` with auto-redirect. F5: Audit Log unified to `!== false` parity. F6: Roles sub-tab gated by `settings_team_manage`. F3 (Realtime invalidation), F7-F16 still open.

**Completed:** 2026-04-27 — N11 audit: read-only walkthrough of the 4-layer permission system. Wrote `docs/audits/2026-04-N11-permissions-audit.md` with 16 confirmed bugs (1 Critical, 5 High, 7 Medium, 3 Low) + 1 UX wording cluster. Filed each as N11-F1 through N11-F17 above. Rejected 2 false alarms (admin_tier doesn't bypass ceilings; agent-scoped pages ARE gated by `ProtectedRoute`).

**Completed:** 2026-04-26 — `5c50c41` — N6 fix: added `previous_session_id` column on `handover_sessions` for succession tracking; `take_over` captures the prior session id and tags its system transcript with `metadata.type='session_refreshed'` when the prior session was timeout/inactivity_timeout/completed; widget keeps polling for 30 min after `handover_ended` and re-enters handover on `session_refreshed`; pending-timeout path in `handover-timer` now uses an N5-style conditional UPDATE so a takeover that wins the race doesn't emit duplicate "Handover ended" pills.

**Completed:** 2026-04-26 — `a53474f` — N5 fix: added `inactivity_reset_at` column set on takeover/accept, extended timer baseline to include agent messages (`speaker=client_user`) and the new column, added race guard (re-read + conditional UPDATE) before firing inactivity_timeout, plus structured `[inactivity_check]`/`[inactivity_skip]` logs.

### N5 — Inactivity timer takeover bug

**Type:** Bug | **Effort:** Small | **Status:** Done
**Spec:** `TotalDash-Spec-N5-Inactivity-Timer-Takeover-Bug.md`

When an agent manually clicks "Take Over" after the inactivity timer has already fired (or is about to), the system creates a new active handover session but the inactivity timer doesn't reset its baseline correctly. Result: duplicate "chat has ended" notifications or a conversation timing out a second time despite the manual takeover succeeding.

**Decisions already made:**
- Code review shows the logic *should* work — `handover-timer` already computes baseline as `Math.max(lastCustomerTime, sessionAcceptedTime)`. Hypothesis is a race condition, not a logic bug.
- Recommended approach: Option A from spec (aggressive) — add explicit `inactivity_reset_at` field on `handover_sessions` and check it in `handover-timer`. Bulletproof against races.

**Touches:** `supabase/functions/handover-actions/index.ts`, `supabase/functions/handover-timer/index.ts`, `handover_sessions` table.

**Open question:** confirm with prod logs whether the issue is genuinely a race or a different bug. Add logging first, observe for a few days, then commit to a fix.

---

- 2026-04-26 — Backend cutover complete: Lovable Cloud → standalone Supabase + Vercel. Domain live at `app.total-dash.com`. Edge Functions deploy via GitHub Actions. `ai-enhance` swapped to direct Anthropic API. `create-text-transcripts` cron re-created. Password reset email flow fixed (route collision + hardcoded URL). RLS gaps for client users patched (`get_user_client_id` helper + new SELECT policies on `clients`/`agencies`). Missing FK constraints added (`client_user_agent_permissions.user_id` → `client_users.user_id`, `role_id` → `client_roles.id`, etc.). Bare `/:agencySlug` route removed in favour of `/login/:agencySlug` to fix path collisions with app routes. `check-domain-context` parser updated for new URL shape.
- 2026-04-25 — Audit produced (C1-C3 critical, I1-I7 important, M1-M8 minor).
- 2026-04 (pre-cutover) — Tickets #3/#4 (login UI + branding), #39 (custom tags), widget consolidation + UI overhaul, Attachments Phase 1 (backend), Phase 5 widget polish.
