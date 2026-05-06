# TotalDash — Backlog

> Last revised: 29 April 2026
> Purpose: living document. Single source of truth for everything outstanding.
> Workflow: pick an item, open a fresh Claude Code session, paste the entry into plan mode, work through clarifications, execute. Mark items done with date + commit hash; consolidate older done entries into the Completed log so this file stays focused on what's left.

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

## Tier 1 — must-haves

### N20 — Production deployment residuals

**Type:** Infrastructure | **Effort:** Tiny remaining | **Status:** Mostly complete
**Spec:** `TotalDash-Spec-N20-Production-Deployment-Planning.md`

Major cutover work is done (Vercel live at `app.total-dash.com`, GitHub Actions deploy pipeline, DNS migrated). Remaining residuals:

- `lovable-tagger` devDependency cleanup — still in `package.json`.
- Old Lovable project deletion — pending stability window (~7 days from cutover).
- Whitelabel custom domain support — separate item, see Tier 3 "Post-stability roadmap".

**Touches:** `package.json`, eventual Lovable account cancellation.

---

### Audit findings — Tier 2 (in flight)

These are real follow-ups from the 25 April audit. C1, C2, C3 (critical tier) all resolved; I1, I2, I3, I4, I5, I6, I7 verified done or shipped (see Completed log). No open items remain in this batch.

---

## Tier 2 — strong wants

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

**Includes the password-reset toast bug noticed during cutover** (the "missing email or password" error firing alongside success toast — likely a P2 form-validation issue).

**Touches:** broad — 10+ files. Single execution preferred to maintain consistency.

---

### N31 — Live operations dashboard (real-time monitoring view)

**Type:** Feature / Analytics | **Effort:** Large (discovery) | **Status:** Parked — reference only

Captured from screenshot shared 2 May 2026. Real-time view that combines KPIs, a live activity feed, channel-mix bars, and a "headcount on shift" framing. Plausibly doubles as an internal ops console and a marketing showcase ("AI handled all of this with zero humans on shift tonight").

**Components in the reference screenshot:**
- **Session window header:** time-range display, e.g. `TONIGHT · 23:00 → 00:38`.
- **KPI strip (3 cards):**
  - *Resolved Today* — count (e.g. 2,987) + delta vs yesterday (e.g. +12%).
  - *Active Conversations* — current count (e.g. 58) + agents-on-shift count.
  - *Avg First Reply* — mean (e.g. 2.1s) + P95 (e.g. 4.4s).
- **Live Activity feed (auto-updating):** rows of timestamp · channel icon · status icon · short outcome summary · status badge. Status badges seen: `RESOLVED`, `HANDED`, `ACTIVE`. Example outcomes: "Refund issued · £19.50", "Engineer booked · Sat 10am", "Handed to Maria · L2 retention", "Invoice sent · INV-2026-04812", "Speed troubleshoot in progress".
- **Channel Mix (last 60m):** horizontal bars + % across Web / WhatsApp / Voice / Email / SMS.
- **Headcount on Shift card:** count + tagline "All conversations above handled with no human on call."

**Dependencies before this is actually buildable:**
- WhatsApp channel — N17 (parked).
- Voice / Email / SMS channels — none exist today; each would need its own ingest path.
- Structured outcome extraction (refund / booking / invoice / etc.) — no schema for this currently; would need either manual tagging, AI summarisation, or a new structured outcome field on conversations / handover sessions.
- "Agents on shift" — needs a schedule / availability source or a live-presence signal.

**Open questions for when this is reopened:**
- Audience: internal ops console, external marketing showcase (e.g. embeddable on `total-dash.com`), or both?
- Definition of "Resolved": AI-only resolutions, handover resolutions, or both combined?
- "Agents on shift" data source: shift schedule table, live presence (Realtime), or self-declared in-app status?
- Outcome categorisation source: manual tag at handover-end, AI summary post-resolution, or a structured outcome schema?

**Constraint noted at capture:** no database changes yet. This entry exists purely as a reference for future planning; schema design happens once the prerequisite channels and outcome model are in motion.

**Touches:** TBD. Likely a new dashboard route, aggregation RPCs against `conversations` / `handover_sessions` / a future outcomes table, plus channel-specific ingest. Multi-channel work is the prerequisite.

---

### Attachments — remaining work

**Type:** Feature | **Effort:** Tiny remaining (config flip) + later phases | **Status:** Phase 2 shipped 28 April; Phases 3-5 parked
**Spec:** `TotalDash-Spec-17-Attachments.md`

Phase 1 (backend) and Phase 2 (widget + dashboard UI) are complete. See the Completed log entries for 2026-04-28 for the full feature list.

**Still outstanding:**

- **Step G — flip `fileUploadEnabled`** in agent settings for the HeyB test agent (`415f07ba-ebb3-4867-bb9f-3207b9994bd0`). Pure config change in the dashboard, not code. Held until Silv decides it's ready for HeyB testers — flip when wanted.

**Phase 3 — Central attachments tab in right panel.** New tab next to Notes/Tags/etc. shows all attachments from the conversation as a grid (images thumbed, files as tiles). Click-through to the message in transcript. No code yet — design + plan needed.

**Phase 4 — Image lightbox.** Click an image bubble (widget or dashboard) opens a full-screen overlay with prev/next, download, close. Today's behaviour is "open in new tab" — works but feels primitive vs. modern chat. Lightbox component goes in shared UI lib so it works on both surfaces.

**Phase 5 — Attachment search and filter.** "Show only conversations with attachments", "search by filename", "filter by file kind". Likely needs a denormalised `has_attachments` column on `conversations` (set by trigger) for the list filter, and a small search RPC for filename grep.

**Lessons locked in for future attachment work:**
- Two-phase upload pattern (stage to storage in `widget-stage-upload`, then commit via `widget-file-upload` with `stagedAttachment` JSON). Reliable, no orphans, fast UI feedback. `agent-file-upload` is the JWT-auth'd dashboard equivalent (single-call, agent-side).
- Storage URLs for non-inline kinds (CSV, text, etc.) need `?download=<filename>` to force `Content-Disposition: attachment` — browsers ignore the HTML `download` attribute cross-origin. Helper is `withDownloadParam` in widget-loader, MessageBubble, and Conversations.
- Drag-and-drop reliability requires the `relatedTarget` pattern (not a counter), a `dataTransfer.types.includes('Files')` guard, and a window-level `dragend`/`drop` reset failsafe. Counter-based implementations drift on Safari and stick the overlay visible.
- `min-w-0` on the inner flex item is required for `truncate` to actually clip long filenames — default `min-width: auto` blocks it.
- File-only message bubbles (no text) collapse the wrapping bubble to nothing and let the `bg-muted` file-tile chip be the visual on its own. Avoids the "double border" look where a coloured user/agent bubble wraps a grey chip.

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

## Tier 3 audit findings — minor cleanup

Low priority. Do opportunistically when touching related code.

- **M1** — `isDepartmentOpen` duplicated. Add cross-pointing comments; deduplicate when convenient.
- **M2** — Race condition in `duplicate-agent` between name-check and insert. Low impact.
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

Date-stamped log of items shipped. Older entries are intentionally terse — open the commit if you need detail. Newer entries keep slightly more context while still relevant.

- **2026-05-06** — `887a095` — N21 (rename "Previous handover(s)" to "Handover Sessions") shipped. One-line edit at `src/pages/client/Conversations.tsx:2866`. Section heading inside the selected conversation's right panel (the handover-history block, distinct from the customer's previous-conversations list below it) now renders as `HANDOVER SESSIONS` (singular) or `HANDOVER SESSIONS (N)` (plural). Source casing changed from sentence-case to title case to match the rest of the file's sub-headers (`Contact Info`, etc.); rendered output is unchanged because the wrapping `<p>` already applies `uppercase tracking-wider`. Backlog entry's "line 1958" pointer was stale — file has grown.
- **2026-05-06** — `e3263f2` — N19 (Agent Config + Client Access merge) shipped. The two tabs `Client Access` (per-agent ceiling toggles) and `Config` (provider credentials + custom variables) are merged into a single `Configuration & Permissions` tab on `AgencyAgentDetails`, now the default tab on page load (was `client-access`). Body layout: Configuration section (renders existing `VoiceflowSettings` / `RetellSettings` with new `hideDangerZone` prop) → `Separator` → Permissions section (agency-only banner + Sidebar pages card + conditional Agent settings sub-tabs card, content lifted wholesale from old `client-access` TabsContent) → `Separator` → Danger Zone (admin-gated `Delete Agent`, same `profiles.role === 'admin'` check pattern as the original settings components). `AgencyAgentDetails` now owns the `AgentDeletionDialog` instance instead of each provider settings component (the prop suppresses both the Danger Zone block and the dialog inside the settings component when `hideDangerZone` is set). Pure UI consolidation — no schema change, no RPC change. Permission toggles still write via `update_agent_config` RPC. Data model deliberately left as `client_X_enabled: boolean`; interaction-level permissions ("client can edit widget" vs "view-only") deferred until actually needed.
- **2026-05-05** — `bfa91b7` — N30 closed as **not needed** (no code shipped). Initial implementation (Option B: localStorage mirror with `storage` event listener for cross-tab sync, plus a `useImpersonation` re-fetch on `impersonation-changed`) was shipped in `bde35ba` + `dfd7f43`, then reverted in `bfa91b7` once Silv confirmed the requirement: tab isolation is intentional. Each tab can hold its own impersonation identity (super_admin in tab A, impersonated agency in tab B) — that's a feature, not a race. The original entry's worry about divergent state leaking into Realtime / filters / guards doesn't materialise: Realtime clients are per-tab, sessionStorage-driven filters are per-tab, and the N29 guard work already lets a super_admin in tab B navigate freely while tab A is impersonating. `src/lib/impersonation-bridge.ts` returns to its post-N29 shape (just the `getImpersonationBridge()` / `hasImpersonationBridge()` helpers).
- **2026-05-05** — `e50a2d1` / `18a6fa4` — N29 (AdminProtectedRoute impersonation awareness) shipped. New `src/lib/impersonation-bridge.ts` exports `hasImpersonationBridge()` (truthy if `preview_mode` or `impersonation_session_id` is set in sessionStorage) and `getImpersonationBridge()` (raw values for callers that need specificity, e.g. AgencyProtectedRoute's `previewMode === 'agency'` semantics). All three route guards now consume the helper instead of inline `sessionStorage.getItem` reads: `AdminProtectedRoute` gains a `useImpersonation()` hook arm to match the hybrid pattern of its siblings (`isImpersonating || hasImpersonationBridge()`); `AgencyProtectedRoute` keeps its role-specific `previewMode === 'agency'` check via the destructured raw value; `ProtectedRoute` drops its inline fallback inside `hasPreviewAccess`. Behavioural no-op — same render/redirect outcomes for every (userType × impersonation) combination. Materially shrinks the N30 (cross-tab race) diff which sits next on the backlog. Bonus follow-up in `18a6fa4`: replaced three dead `sessionStorage.getItem('preview_mode') === '1'` checks in `Auth.tsx`, `AdminLogin.tsx`, and `AgencyLogin.tsx` (introduced new in N12 commit `4ce209b` but never matched anything — `useImpersonation.startImpersonation` writes `'agency'` or `'client'`, never `'1'`) with the new helper. Failure mode the dead checks were *meant* to prevent: super_admin mid-impersonation visiting any login page (e.g. to verify a branded login during a demo) would get full-page-redirected to their own dashboard, blowing up the impersonation context. Now correctly skipped.
- **2026-05-01** — `d36c9e5` — N12 follow-up: softened the cross-role auto-redirect introduced by N12. Pasting another role's login URL while signed in (e.g. super_admin → `/login/fiveleaf` to verify Fiveleaf branding renders correctly) was bouncing the user through `/admin/login` to `/admin/agencies` before the page could render — blocking branding verification, stakeholder demos, and "sign out then sign in as someone else" flows. Now: matched-role still auto-redirects (the original N12 stale-session win is preserved); mismatched-role renders the page normally with a slim amber `WrongRoleBanner` above the login card showing email + role and two actions ("Go to your dashboard", "Sign out"). New `src/components/WrongRoleBanner.tsx` (~70 LOC); each of the 3 login pages swaps its mismatch redirect for `setMismatchedAs(detected)` + conditional banner render. Post-sign-in wrong-portal flow (typing wrong-role creds → sign out + toast + redirect) and `sessionStorage.preview_mode === '1'` impersonation skip are unchanged. Verified branded login flow already worked end-to-end (`/login/:agencySlug` → `SlugBasedAuth` → `loginAgencyContext` sessionStorage → `useBranding({ isClientView: true, agencyId })` → agency `logo_*` / `favicon_*` / `name` overlay platform defaults) — Silv just couldn't see it before because of the redirect. Banner state stays after this fix so the branded page is finally visible to admins.
- **2026-05-01** — `40cadb7` — N13 (display login URLs) shipped, with whitelabel forward-compatibility built in. New `getClientLoginUrl()` / `getAgencyLoginUrl()` helpers in `src/lib/login-urls.ts` are the single source of truth: when `whitelabel_verified && whitelabel_domain` are set on the agency, the helper returns the bare whitelabel URL (`https://dashboard.{domain}`); otherwise the slug-based path (`https://app.total-dash.com/login/{slug}`). New `LoginURLDisplay` component (read-only input + Copy button + 2s confirm + toast) wired into 3 surfaces: AgencySettings General tab (two cards — "Agency staff login" + "Client login URL"), AgencyClientDetails Overview tab (per-client handoff), and Settings.tsx (client `/settings`) General tab ("Your team's login URL" for sharing with new colleagues). Refactor side-effects: removed the separate fetch + ad-hoc URL construction in AgencySettings (was a third copy of the whitelabel pattern); AgencyLogin client-diversion redirect now uses the helper instead of inlining the URL; ClientSettings.tsx had a stale per-client URL preview (`total-dash.com/{agency}/{client}` — missing `/login/` prefix and suggesting a per-client URL form that doesn't exist) which has been deleted. Decision recorded: all clients of an agency share the same agency-slug URL (no per-client slug in displayed login URLs); on whitelabel the URL is the bare subdomain.domain (no path suffix). Whitelabel custom-domain implementation can now flip the helper output across all three surfaces with no per-page edits.
- **2026-04-29** — `4ce209b` — N12 (smart login redirect) shipped. New `detectUserTypeAfterAuth` utility in `src/lib/auth.ts` runs three parallel role-table queries (`super_admin_users`, `agency_users`, `client_users`) and returns the first match in `loadProfile()` priority order (super_admin > agency > client), plus `loginPathForUserType` / `dashboardPathForUserType` helpers. Wired into all three login pages: post-sign-in detect → if matches the page's expected role, happy-path navigate to dashboard; if mismatch, sign out, toast "Wrong portal — redirecting…", `window.location.href = loginPathForUserType(detected)`. Each login page also gets an already-authenticated `useEffect` that auto-redirects returning visitors with stale sessions to their actual dashboard (skips `sessionStorage.preview_mode === '1'` so impersonation isn't disrupted). `AgencyLogin` preserves its existing whitelabel-aware client-diversion UI (interactive "Go to your login page" card) — the redirect URL still honours `whitelabel_verified` + `whitelabel_domain` for clients of agencies on a custom domain. Route guards hardened: `AdminProtectedRoute` now redirects mismatched signed-in users to *their* dashboard (`/agency` or `/`) instead of `/admin/login`, and skips the bounce when `preview_mode` bridge is set. `AgencyProtectedRoute` and `ProtectedRoute` similarly redirect agency / super_admin / client mismatches to their dashboards rather than to a login page. Two related issues spun out as new backlog entries N29 (full impersonation-aware AdminProtectedRoute) and N30 (cross-tab impersonation race).
- **2026-04-29** — N9 (search overhaul) + N10 (filter overlay + toolbar toggle) parked off the backlog. N9 is being executed in a parallel Claude Code session (CommandSearch / Cmd+K upgrade with date range + mirrored dashboard chips + `search_conversations` RPC); review feedback on that plan was sent over before this entry was logged. N10 was paired with N9 at the toolbar/prefs level — its filter-overlay modal idea is largely subsumed by N9's chip-mirroring, and re-evaluation can happen post-N9 ship if any gaps remain. Both removed from Tier 2 to keep the active list focused.
- **2026-04-29** — `252536b` — N7 (End Handover button styling). Option B picked: End Handover button keeps its `variant="outline"` shape but gains a red destructive tint (`text-destructive border-destructive/50 hover:bg-destructive/10`) so it's visually distinct from the neutral Transfer button next to it. Bonus tweak: inside the End Handover dialog, the "End — Keep in Aftercare" button now uses a yellow-tinted outline (`text-yellow-700 border-yellow-300 hover:bg-yellow-50` + dark variants) matching the Aftercare status badge palette, so the two end-paths telegraph which status they land in (yellow → Aftercare, default primary → Resolved). No behaviour change.
- **2026-04-29** — `49ad83c` — N4 (date separators in transcript) plus two bundled tweaks. Plain-text centred date separator (`2nd September 2026`, UK ordinal day-month-year via `date-fns` `do MMMM yyyy`) injected at the top of each calendar-day group in both the dashboard Conversations transcript map and the Transcripts page. `MessageBubble` timestamp + the inline `client_user` timestamp + the conversation card Row 2 (last-message line) now share one `h:mm a · d/M` format (e.g. `10:38 AM · 8/3`) for cross-speaker consistency. Widget gets a hover-reveal time per bubble: time-only (no date), absolutely positioned to the *outer* side of the bubble (left for user, right for AI/agent) via a new `vf-msg-body` wrapper inside `vf-msg-user-wrap` / new `vf-msg-bot-wrap`; `[data-msg-id]:hover` toggles `opacity` so layout doesn't shift. `max-width: 78%` moved from `.vf-msg-bot` / `.vf-msg-user` onto `.vf-msg-body` so the bubble width still constrains relative to wrapper, not body.
- **2026-04-29** — `7573c41` / `7d1e177` — N3 (Waiting/Transfer status timers, expanded scope vs original spec). Shipped: live timer inside the status badge (`Waiting · 1m 30s` red, or `TRANSFER · 1m 30s` for transfer-takeover-type pending sessions, no owner initials); right-column pending-card timer reformatted to current/max with green→amber→red colour ramp via existing `getResponseTimeColor`; bottom-right standalone Clock pill scoped to `in_handover` rows with an unanswered customer message (was over-firing on pending). `formatWaitTime` updated to seconds-within-minutes (`1m 30s`, `2h 5m`) — affects badge timer, pending-card, in_handover pill, and the textbox-footer "Customer waiting" indicator. Reinstated `first_unanswered_message_at` SET in `voiceflow-interact`'s in_handover branch (column was only ever cleared in repo, never set, so the in_handover pill never fired). Fix-up follow-up after deploy: switched the pendingMeta loader's `handover_sessions → departments` join to the explicit `departments:department_id(...)` form (the implicit form was returning empty so the badge timer never showed); added `first_unanswered_message_at: null` clear to every handover-actions handler that transitions away from in_handover (accept_handover, take_over, end_handover, mark_resolved, transfer) so a stale "customer waiting" timestamp can't leak across status transitions; and the bottom-right pill for the *selected* row now reads `first_unanswered_message_at` from `selectedConversation` instead of the list cache, so it tracks the textbox indicator exactly.
- **2026-04-28** — `8e1487f` / `22fe8d3` / `5ceeb85` — N1 (My Conversations filter). Icon-only `UserCheck` toggle on Row 1 of the Conversations toolbar, left of the title, filters the list to `owner_id === currentClientUserId`. AND-logic with status/department/tag/search. Gated on `canUseMineFilter = userType === 'client' || (isImpersonating && impersonationMode === 'view_as_user')`: real client login or view-as-user impersonation enables it; full-access impersonation / preview-as-client shows it disabled with a tooltip nudging toward view-as-user. Pure client-side filter; bulk-select reset includes `myOnly` in deps.
- **2026-04-28** — `bfe8cae` — I3 (atomic conversation status transitions). New `transition_conversation_status` Postgres function wraps the conversation update + status_history insert + system transcript insert in a single transaction. Refactors 7 sites (handover-actions: accept / takeover / end / transfer / mark_resolved; handover-timer: pending / inactivity timeout). Eliminates the half-state where the status flip lands but the paired transcript or history row doesn't. Side-improvement: transfers now write a status_history row they previously skipped. The trailing "Handover ended" widget-mechanics transcript in the timer paths stays outside the atomic block (widget signal, not user-visible status). I4 + I6 verified already done — `useMultiTenantAuth.tsx:224` already uses `window.location.replace`; `loadClientUser` + `loadPendingIds` in Conversations.tsx already toast on error. Audit batch closed.
- **2026-04-28** — `846eea8` / `d8c3643` — Inactivity nudge fix. The "Are you still there?" nudge had two bugs sharing one root cause: it was inserted with `speaker='assistant'` but the existence-check was filtered to `speaker='system'`, so (a) the "once" toggle was silently broken — every cron tick re-emitted the nudge — and (b) the widget's handover poll skips assistant-speaker transcripts (those belong to the pre-handover AI flow), so customers never saw the nudge. Switched the insert to `speaker='client_user'` with `metadata.client_user_name` from `handover_sessions.agent_name` so it renders as a proper agent message in both surfaces (named bubble in dashboard, normal agent bubble in widget). Critical secondary fix in the same commit: the `lastAgentMsg` baseline query now filters `metadata->>type=inactivity_nudge` out, otherwise the nudge would mark itself as the latest agent activity and reset the inactivity clock — breaking subsequent nudges AND the hard timeout.
- **2026-04-28** — `e7522b4` — Attachments Phase 2 finishing touches: drag-and-drop on the dashboard transcript panel + widget drag-drop reliability fix. Dashboard agents can now drop files anywhere on the transcript panel during their active handover; same `handleAgentAttach` validation as the paperclip. Widget drag-drop replaced the `dragCounter` pattern (which drifted on Safari and stuck the overlay) with a `relatedTarget` check + `dataTransfer.types.includes('Files')` guard + window-level `dragend`/`drop` failsafe. Drag-and-drop is now deterministic on both surfaces.
- **2026-04-28** — `82fea11` — Cleaner file-attachment chips in the dashboard transcript. File-only messages (no text) now collapse the wrapping bubble entirely so the `bg-muted` file-tile chip is the visual on its own — eliminates the "double border" look where a coloured user/agent bubble wrapped a grey chip. Tile gets explicit `text-foreground` / `text-muted-foreground` colours, a 9×9 icon container, filename + human-readable size in two lines, and a download icon. Same pattern applied to MessageBubble and the inline `client_user` transcript path.
- **2026-04-28** — `af2f58e` / `47ad0eb` — Attachments Phase 2 polish round: dashboard pending-state preview (mirror of widget two-phase flow — picked files queue with thumbnails + per-tile remove + caption-on-first-file send), widget-side CSV download fix (`withDownloadParam` helper appends `?download=<filename>` so Supabase serves with `Content-Disposition: attachment`; cross-origin `download` attr is ignored), long-filename overflow fix (`min-w-0` on the inner flex item so `truncate` actually clips), thin-padding for image-only user bubbles (px-4 py-2.5 only when text/buttons present, else p-1).
- **2026-04-28** — Attachments Phase 2 main shipment (commits `fb2dcca` → `0c0dc70` → `53833d0` → `a15316a`): paperclip + drag-drop + multi-file on widget; two-phase upload (`widget-stage-upload` for storage, `widget-file-upload` to commit a `stagedAttachment` JSON); dashboard agent-side paperclip with JWT-auth'd `agent-file-upload`; `renderMessages` rendering of image / video / audio / file attachments by kind; chat history preview derives from `attachments[0]` when text empty (📷 🎥 🎤 📎 emoji prefixes); accept-allowlist on the file input matches the server-side allowlist exactly. Step G (flip `fileUploadEnabled` for HeyB) still pending — held until Silv decides to switch HeyB testers on.
- **2026-04-28** — `34ebf78` / `e4b8f28` / `3717f08` — N11-F17 + N28 + UI clarity bundle. Added scope subheadings (Role defaults / Per-user / cap-coloured ceiling banners), inline role-default + reset on per-user override rows, View-only badges on Settings sub-tabs, user-count chips on Roles, dialog widths bumped to `max-w-3xl`, sticky dialog footer, Settings page padding tightened. Bonus: switched `ClientAgentAssignments.tsx` to `agents_safe` to close a CLAUDE.md rule #2 gap.
- **2026-04-28** — Audit verification pass: **C2** is a false alarm (column projection strips api_key/voiceflow_api_key/retell_api_key from `agents_safe` regardless of `security_invoker` mode — flipping to DEFINER would be a no-op). **I1** has rate limit (60/min per IP+agent), agent existence/status check, and userId regex validation already in place. **I2** all `JSON.parse` calls (3 inline + early `req.json()`) wrapped, returns 400 not 500. **I5** both `AgentSpecs.tsx` and `Guides.tsx` already query `agents_safe` (audit entry was stale). **I7** `voiceflow_version_id` is configurable via `agent.config`, with `"production"` only as fallback. No code changes needed.
- **2026-04-28** — `6b56bba` — N27 (Add User dup-key error): replaced post-EF INSERT loop with reconciliation pass; per-row error aggregation toasted on partial failure.
- **2026-04-28** — `0208d4f` — N11-F3 + F9: live permission invalidation via Supabase Realtime. Two channels (per-user/client + per-agent) cover all 4 permission layers; 250ms-debounced refetch through existing loaders; selected agent preserved across reloads. Preview mode short-circuits.
- **2026-04-28** — N11-F15: extracted resolver helpers (`resolveAgentScopedKey`, `resolveClientScopedKey`, `buildAgentPermissions`, `buildCompanySettingsPermissions`) to module scope in `useClientAgentContext.tsx`. Single source of truth for the 4-layer stack.
- **2026-04-28** — N11 follow-ups F7, F8, F10, F12, F13, F14, F16: cross-scope mixing in `resolveClientScoped` fixed; Sidebar/ProtectedRoute use canonical `companySettingsPermissions`; `loadAgentPermissions` fail-closes on error; new-user grant + client-scoped save diff vs template before flagging `has_overrides`; `AgencyAgentDetails` switched to `agents_safe`; RolesManagement Save button hidden when 0 users / labelled "Apply to N users" otherwise. F11 confirmed false alarm.
- **2026-04-27** — `3bd2171` — N11 follow-ups F1, F2, F4, F5, F6: sync `client_user_permissions.role_id` on role change + persist in-memory edits; optimistic-with-rollback on Roles toggles; gate Departments / Audit Log / Roles sub-tabs by their respective permissions; `SubTabGuard` auto-redirects when active sub-tab gets hidden.
- **2026-04-27** — N11 audit + report (`docs/audits/2026-04-N11-permissions-audit.md`). 16 confirmed bugs filed as F1-F16 + F17 UX cluster; F1-F16 all complete by 28 April; F17 shipped 28 April.
- **2026-04-27** — N8 — Team-wide conversation archive shipped: `is_archived` / `archived_at` / `archived_by` columns + `set_conversation_archived` RPC; archive button on conversations; "Include archived" toggle on Transcripts.
- **2026-04-26** — `5c50c41` — N6 (handover succession): `previous_session_id` column, `session_refreshed` metadata tag, 30-min widget polling for refresh, race-guarded pending-timeout path.
- **2026-04-26** — `a53474f` — N5 (inactivity-timer takeover): `inactivity_reset_at` column + race-guarded conditional UPDATE before firing inactivity_timeout.
- **2026-04-26** — Backend cutover complete: Lovable Cloud → standalone Supabase + Vercel. `app.total-dash.com` live. Edge Functions deploy via GitHub Actions. `ai-enhance` swapped to direct Anthropic API. Password-reset email flow fixed. RLS gaps for client users patched. FK constraint repair. Bare `/:agencySlug` route removed in favour of `/login/:agencySlug`.
- **2026-04-25** — Audit produced: C1-C3 critical (all resolved), I1-I7 important (I1/I2/I5/I7 already done; I3/I4/I6 still open), M1-M8 minor.
- **2026-04 (pre-cutover)** — Login UI + branding (#3/#4), custom tags (#39), widget consolidation, Attachments Phase 1 (backend), Phase 5 widget polish.
