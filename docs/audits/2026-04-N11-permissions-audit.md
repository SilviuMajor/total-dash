# N11 — Permission System Audit

**Date:** 2026-04-27
**Auditor:** Claude Code (read-only audit; no code changed)
**Scope:** the 4-layer permission resolution system + every save/read/enforce site

This document confirms or rejects each candidate finding from the planning phase, plus everything new spotted during code-walking. It does NOT change behaviour. Each confirmed bug gets a follow-up entry in `OUTSTANDING.md`.

---

## 1. Architecture (confirmed)

The 4-layer model in the spec is accurate.

| Layer | Source | Read in | Written in |
|---|---|---|---|
| **L1 Agency ceiling** (per-agent) | `agents.config[client_*_enabled]` | `useClientAgentContext.tsx:343/529/648` | `AgencyAgentDetails.tsx:162` (via `update_agent_config` RPC ✓) |
| **L2 Client ceiling** (per-client) | `client_settings.admin_capabilities[*_enabled]` | `useClientAgentContext.tsx:306/490/655` | `AgencyClientDetails.tsx:66-76` (direct upsert) |
| **L3 Role template** | `role_permission_templates.permissions` (agent-scoped) + `client_roles.client_permissions` (client-scoped) | `useClientAgentContext.tsx:466/635/281` | `RolesManagement.tsx:163-176` and `:178-192` |
| **L4 User override** | `client_user_agent_permissions` (agent-scoped) + `client_user_permissions` (client-scoped); both gated by `has_overrides` boolean | `useClientAgentContext.tsx:438-486` | `ClientUsersManagement.tsx:1502-1586` (save), `:1373-1407` (Reset) |

**Resolution order (agent-scoped):** ceiling false → false; admin_tier → true; user override (if `has_overrides`) → value; role template → value || false.

**Resolution order (client-scoped):** ceiling false → false; admin_tier → true; user override (if `has_clientOverrides`) → value; role.client_permissions → value || false.

**`is_admin_tier` does NOT bypass ceilings** (the original explore agent misread this — ceiling check runs first). One concern remains: the order means an explicitly-set ceiling is absolute, but a missing ceiling key (undefined) falls through to admin_tier which returns true. That is intended behaviour: ceilings need to be explicitly disabled to block admins.

**Enforcement chain for client routes:** `App.tsx:173-181` wraps each agent-scoped page in `ProtectedRoute requiredPage="..."`. `ProtectedRoute.tsx:60-78,107-111` reads `selectedAgentPermissions[requiredPage]` and redirects/blanks if false. Sidebar (`Sidebar.tsx:81-124`) hides nav items by the same field with `=== true`. Both resolve from the same `useClientAgentContext` source.

---

## 2. Findings

### 2.1 Critical

#### F1 — "Keep current permissions" leaks orphan `role_id` and ignores unsaved UI edits

**Files / lines:** `src/components/client-management/ClientUsersManagement.tsx:1746-1767`

The role-change modal's "Keep current permissions" path runs:

```ts
await supabase
  .from('client_user_agent_permissions')
  .update({ role_id: newRoleId, has_overrides: true })
  .eq('user_id', user.user_id)
  .eq('client_id', clientId);
```

Two bugs:

1. **`client_user_permissions.role_id` is never updated.** That row continues to reference the OLD role. The "Reset to defaults" path on the same modal (`:1771-1828`) has the same omission. The standalone "Reset to role defaults" button on the user row (`:1373-1407`) DOES upsert with the new `role_id`, so it's only the role-change modal that leaks this.
2. **The `permissions` field is not written.** Whatever DB value existed remains. If the admin tweaked any toggle in the panel UI before opening the role-change modal, those tweaks are silently discarded; the toast message ("Kept current permissions as overrides") implies they were saved.

**Repro:** assign User1 to RoleA. Open user row, toggle one permission off (do not save). Click "Change role" → select RoleB → "Keep current permissions". Inspect both `client_user_agent_permissions` (role_id=RoleB, permissions=DB-state-before-the-tweak) and `client_user_permissions` (role_id=RoleA, stale).

**Severity:** Critical. Data integrity bug + silent user-data-loss. Discoverable in normal use. Easy fix: also update `client_user_permissions.role_id`, and either persist the in-memory edits or warn that they will be lost.

---

### 2.2 High

#### F2 — Silent failures on every Roles toggle

**Files / lines:** `src/components/settings/RolesManagement.tsx:156-176`, `:178-192`, `:203-218`

`togglePermission`, `toggleClientPermissions`, and `applyToAllUsers` all call `await supabase.from(...).update(...)` (or `.upsert`) without checking `error`. Local state updates optimistically; toasts say "Saved" / "Applied" regardless of success.

`applyToAllUsers` (`:206-217`) loops over agents and shows a single success toast at the end with no aggregate error handling.

**Likely real-world impact:** matches the symptom in the original spec — "Company Settings sub-tab toggles may not persist". An RLS policy denial, network blip, or stale row would fail silently.

**Repro:** disable network during a toggle; see "Saved" toast and broken DB state. Or revoke the user's UPDATE policy on `client_roles` and confirm the toggle still appears to succeed in UI.

**Severity:** High.

#### F3 — Active sessions don't see role-permission changes until reload

**Files / lines:** `src/components/settings/RolesManagement.tsx` (no consumer of `useClientAgentContext` mutations)

After `togglePermission` / `toggleClientPermissions` succeed, no signal is sent to `useClientAgentContext`. A user already logged in with that role keeps their cached `selectedAgentPermissions` until they hard-refresh. The same is true for the "Apply to all" path in real-time — `applyToAllUsers` updates DB rows but doesn't broadcast.

**Likely real-world impact:** matches the "toggles don't take effect" symptom in the spec.

**Repro:** as Admin, open `RolesManagement` and turn off `Conversations` for RoleX. In a second browser session, log in as User-with-RoleX and confirm Conversations link is still present in the sidebar. Reload. Link disappears.

**Severity:** High. Fix needs either Supabase Realtime subscription on `role_permission_templates` and `client_roles`, or a manual context invalidation (e.g. broadcast via custom channel).

#### F4 — `Settings.tsx` Departments sub-tab not gated by its own permission

**Files / lines:** `src/pages/Settings.tsx:88-89` (`showDepartments` is computed) **but never used**. Departments is rendered inside the `team-permissions` tab content (`:127-164`) and gated only by `showTeam`.

**Effect:** flipping `client_departments_enabled` OFF in `AgencyClientDetails` does nothing. The Departments sub-tab still renders. The same goes for `settings_departments_view` permission.

**Severity:** High. Direct violation of the documented capability ceiling.

#### F5 — `Settings.tsx` audit log uses `=== true` while other tabs use `!== false`

**Files / lines:** `src/pages/Settings.tsx:88-97`

Departments / Team / Canned Responses / General all gate with `!== false` (default-allow). Audit Log gates with `=== true` (default-deny). For new clients with empty `client_settings.admin_capabilities`, this means audit log is hidden by default while everything else is visible.

**Severity:** High. Inconsistent default behaviour. Pick one. Recommend `!== false` for parity, OR `=== true` everywhere if default-deny is intended (safer).

#### F6 — `RolesManagement` rendered without `readOnly` prop in Settings.tsx

**Files / lines:** `src/pages/Settings.tsx:163`

```tsx
{teamSubTab === "roles" && <RolesManagement clientId={clientId} />}
```

`RolesManagement` accepts no `readOnly` prop and contains no internal manage-permission check. A client user with `settings_team_view: true, settings_team_manage: false` will see the Team & Permissions tab AND the Roles sub-tab, can click into any role, and can flip role permissions for the entire client. Privilege escalation: a view-only Team admin gets full role-edit power.

**Severity:** High. Real exposure once HeyB has multiple seats with mixed permission tiers.

---

### 2.3 Medium

#### F7 — Cross-scope mixing in `resolveClientScoped`

**Files / lines:** `src/hooks/useClientAgentContext.tsx:539-544` (real-user agent loop) and `:349-354` (impersonation), and `:654-659` (selected-agent useEffect)

```ts
const resolveClientScoped = (key: string, capKey: string): boolean => {
  if (adminCaps[capKey] === false) return false;
  if (role?.is_admin_tier) return true;
  if (hasOverrides && userOverrides[key] !== undefined) return userOverrides[key];
  // ↑↑↑ uses agent-scoped hasOverrides + agent-scoped userOverrides JSON
  // ↑↑↑ should use hasClientOverrides + userClientOverrides
  return role?.client_permissions?.[key] || false;
};
```

By contrast, `resolveCompanyPerm` (`:489-494`, `:305-310`) — used by `setCompanySettingsPermissions` — is correct: it uses `hasClientOverrides` and `userClientOverrides`.

**Practical impact today: latent.** The agent-scoped `permissions` JSON only ever contains the 7 agent-scoped keys (`conversations`, `transcripts`, …). Looking up `userOverrides['settings_page']` yields `undefined`, so the buggy branch falls through to the role check. **However**, anyone who manages to land a `settings_page` or `audit_log` key into the agent-scoped JSON via SQL or a future write path would silently ride this bug.

**Why it still matters:**
1. `selectedAgentPermissions.settings_page` and `selectedAgentPermissions.audit_log` are produced by this resolver. The Sidebar reads `selectedAgentPermissions.settings_page` (`:107`) to gate the Settings link. `ProtectedRoute requiredPage="settings_page"` reads from the same. Both should be reading `companySettingsPermissions.settings_page` (canonical, client-scoped) — see F8.
2. Resolution functions are duplicated 4× in this file with subtle drift. Any future change makes the drift worse.

**Severity:** Medium. Latent today. Fix by extracting `resolveClientScoped`/`resolveCompanyPerm` once and using `hasClientOverrides`/`userClientOverrides` consistently.

#### F8 — Settings link gated by per-agent `settings_page` instead of canonical client-scoped value

**Files / lines:** `src/components/Sidebar.tsx:107`, `src/components/ProtectedRoute.tsx:60-78`, `src/App.tsx:181`

`settings_page` is fundamentally a client-scoped permission (lives on `client_roles.client_permissions` and `client_user_permissions.client_permissions`). The canonical resolved value is on `companySettingsPermissions.settings_page`. But:

- Sidebar reads `selectedAgentPermissions.settings_page` (per-agent path, F7-affected resolver)
- `ProtectedRoute requiredPage="settings_page"` reads `selectedAgentPermissions.settings_page`
- Same for `audit_log`

If a user has agents A and B and the resolution differs between them (it shouldn't today, since both go through the same client-scoped lookup, but it's incidental), the Settings link could flicker on agent switch.

**Severity:** Medium. Fix is to have these consumers read `companySettingsPermissions` directly for `settings_page` and `audit_log`, and remove those two keys from `AgentPermissions` entirely.

#### F9 — No cache invalidation when agency flips a Layer-2 ceiling

**Files / lines:** `src/pages/agency/AgencyClientDetails.tsx:66-76`

`updateCapability` writes to `client_settings.admin_capabilities` and that's it. Client users mid-session don't see the change; their `companyCapabilities` and `companySettingsPermissions` were resolved on initial load and never re-fetched.

**Severity:** Medium. Same fix family as F3 (Realtime subscription on `client_settings`, or manual broadcast).

#### F10 — `loadAgentPermissions` not awaited; errors swallowed

**Files / lines:** `src/hooks/useClientAgentContext.tsx:593-673` (defined inside useEffect, called at `:673` without await)

The effect can't `await` the function (effects can't return promises), so this is structurally fine, but there is no `try/catch`. A failed Supabase query throws into the promise's microtask and is dropped. The previous agent's resolved permissions stay in state; the user sees stale gating.

**Severity:** Medium. Fix: wrap the body in try/catch with explicit error logging + a toast.

#### F11 — User-level toggles always-clickable when ceiling blocks

**Files / lines:** `src/components/client-management/ClientUsersManagement.tsx` (per-user permission toggles — confirmed across the agent-permission grid and client-permission section)

There is no logic that disables a user-level toggle when the corresponding agency ceiling (`agents.config[client_*_enabled] === false` or `client_settings.admin_capabilities[*_enabled] === false`) is in force. The admin can flip the switch, see "Saved", and the change has zero effect on resolved permissions because the ceiling short-circuits.

`RolesManagement.tsx:148-153` does filter visible permissions by ceiling (`getVisiblePermKeys`, `getVisibleCompanyTabs`). The pattern just isn't applied at the user level.

**Severity:** Medium. UX-only — no security risk — but it's exactly the "I flipped the switch and nothing happened" symptom in the original spec.

#### F12 — New-user agent grant hardcodes `has_overrides: false` even with custom perms

**Files / lines:** `src/components/client-management/ClientUsersManagement.tsx:1535-1550`

When granting a user access to a new agent for the first time, the insert hardcodes `has_overrides: false`. The `permissions` JSON, however, comes from `selectedUserAgentPermissions[agent.id]` which the admin may have customised in the panel. If those custom values differ from the role template, the user IS effectively overridden but the flag claims they aren't — so the user resolution uses the role template (line 535), ignoring the saved customisation.

**Severity:** Medium. Compare against template; set `has_overrides` accordingly (same logic as the UPDATE path at `:1516-1518`).

#### F13 — Client-scoped override flag set by "any keys present" rather than diff against template

**Files / lines:** `src/components/client-management/ClientUsersManagement.tsx:1564-1572`

```ts
.upsert({
  ...
  client_permissions: selectedUserClientPerms,
  has_overrides: Object.keys(selectedUserClientPerms).length > 0,
}, { onConflict: 'user_id,client_id' });
```

Sets `has_overrides: true` whenever the JSON has any keys, regardless of whether those values match the role template. So a user who never had overrides, opens their panel (which loads role defaults into state), and clicks Save without changing anything, will end up flagged `has_overrides: true`. This in turn shows the "Reset to role defaults" button on the user row even though there's nothing to reset.

**Severity:** Medium. Should diff against `roles.find(r => r.id === user.role_id)?.client_permissions` and only flag override when values differ.

---

### 2.4 Low

#### F14 — `AgencyAgentDetails` reads `agents` directly instead of `agents_safe`

**Files / lines:** `src/pages/agency/AgencyAgentDetails.tsx:69`

Safe in practice (route is agency-only), but inconsistent with the codebase rule documented in CLAUDE.md (#2). Note for cleanup.

**Severity:** Low.

#### F15 — Resolution functions duplicated 4× in `useClientAgentContext.tsx`

**Files / lines:** `src/hooks/useClientAgentContext.tsx` — `resolveCompanyPerm` and `resolveClientScoped`/`resolvePermission` appear in `loadClientAgentsForPreview` (preview-mode only sets to true), `loadClientAgentsAsUser` (impersonation), `loadClientAgents` (real user), and the per-agent useEffect. The drift in F7 already exists between copies.

**Severity:** Low (refactor opportunity, not a behaviour bug on its own).

#### F16 — `RolesManagement` "Save" button does nothing for users with no users-on-role

**Files / lines:** `src/components/settings/RolesManagement.tsx:194-201`, button at `:482` and `:608`

If `userCounts[roleId] === 0`, clicking Save just shows a "Saved" toast; toggles already persisted on change. UX confusion: admin may think Save is required.

**Severity:** Low.

---

## 3. UX wording issues

These match the original spec's note about ambiguous wording. Tracked as a single follow-up.

- **`RolesManagement.tsx`** uses raw permission labels ("Conversations", "Transcripts", …) without indicating "Role default" or "All users with this role". The `Roles` page heading does set context.
- **`ClientUsersManagement.tsx`** per-user toggles use the same labels; no "Override" / "Override for this user only" indicator.
- **`AgencyClientDetails.tsx`** capability toggles say "Visible to Client" / "Allow clients to view and manage…" but don't say "Agency-wide ceiling" / "Applies to all users in this client".
- **`AgencyAgentDetails.tsx`** ceiling toggles in the agent-config panel — no language indicating they're a hard ceiling for all client users.
- **Settings sub-tab labels** don't visually distinguish "View only" from "Can edit" mode (handled by the `readOnly` prop, but no UI indicator on the tab itself).

---

## 4. Test matrix results

Verified by code-walking the resolution chain. Live data confirmation pending.

### Agent-scoped (7 keys × 4 paths)

| Key | RolesManagement save → DB | RolesManagement Apply-to-all | Per-user override save | ProtectedRoute gate | Sidebar gate | Page-internal check |
|---|---|---|---|---|---|---|
| `conversations` | ✓ (silent fail F2) | ✓ (silent fail F2) | ✓ | ✓ | ✓ | not done (route guard handles) |
| `transcripts` | same | same | same | ✓ | ✓ | same |
| `analytics` | same | same | same | ✓ | ✓ | same |
| `specs` | same | same | same | ✓ | ✓ | same |
| `knowledge_base` | same | same | same | ✓ | ✓ | same |
| `guides` | same | same | same | ✓ | ✓ | same |
| `agent_settings` | same | same | same | ✓ | ✓ | same |

All seven gate correctly at the route level. Save-side has F2 silent-failure issue on every key.

### Client-scoped (9 keys)

| Key | Settings.tsx tab gate | Sub-component readOnly | Save path |
|---|---|---|---|
| `settings_page` | ✓ via `getDefaultTab` + tab visibility | n/a | ✓ |
| `settings_departments_view` | **✗ `showDepartments` is dead code (F4)** | n/a | ✓ |
| `settings_departments_manage` | n/a (sub-tab) | ✓ via readOnly prop on `DepartmentManagement` | ✓ |
| `settings_team_view` | ✓ | n/a | ✓ |
| `settings_team_manage` | n/a | ✓ via readOnly on `ClientUsersManagement` BUT **✗ `RolesManagement` not gated (F6)** | ✓ |
| `settings_canned_responses_view` | ✓ | n/a | ✓ |
| `settings_canned_responses_manage` | n/a | ✓ via readOnly on `CannedResponsesSettings` | ✓ |
| `settings_general_view` | ✓ | n/a | ✓ |
| `settings_general_manage` | n/a | General tab is fully read-only by design (`disabled` inputs) | ✓ |
| `settings_audit_log_view` | ✓ but **inconsistent op (F5)** | always read-only | ✓ |

---

## 5. Summary

- **Confirmed bugs:** 16 (1 Critical, 5 High, 7 Medium, 3 Low)
- **False alarms (rejected):** 2 (admin_tier ceiling bypass; pages don't check perms — `ProtectedRoute` does it)
- **Open architecture decisions:** none — `is_admin_tier` already runs after ceiling and that's correct

### Suggested fix order

1. **F1** (data integrity, role change leaks orphan role_id) — small, contained
2. **F4** (dead `showDepartments` allowing tab to render) — one-line fix
3. **F6** (RolesManagement readOnly bypass) — small but real exposure
4. **F2 + F11** (silent saves + ungated user-level toggles) — small bundle
5. **F3 + F9** (live propagation of role/ceiling changes) — needs Realtime; bigger effort
6. **F5 + F12 + F13** (consistency cleanups) — small
7. **F7 + F8 + F15** (resolver consolidation + canonical settings_page source) — refactor; do together
8. **F10, F14, F16** — opportunistic
9. **UX wording** — single follow-up pass

The critical / high tier (F1–F6) is realistic to land before HeyB migration. F7-F8-F15 (resolver refactor) is the highest-leverage long-term fix and should follow.

### Files touched in audit (for reference)

- `src/hooks/useClientAgentContext.tsx`
- `src/components/settings/RolesManagement.tsx`
- `src/components/client-management/ClientUsersManagement.tsx`
- `src/pages/Settings.tsx`
- `src/pages/client/{Conversations,Analytics,AgentSpecs,KnowledgeBase,Guides,AgentSettings,Transcripts,TextTranscripts}.tsx`
- `src/components/Sidebar.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/agency/AgencyClientDetails.tsx`
- `src/pages/agency/AgencyAgentDetails.tsx`
- `src/App.tsx`
