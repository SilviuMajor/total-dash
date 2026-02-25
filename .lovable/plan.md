
## Code Quality Pass — TypeScript Strictness, Console Cleanup, Auth Consolidation

This is a pure code cleanup pass: no UI changes, no database changes, no new dependencies. Three independent concerns addressed in order.

---

### Part 1: TypeScript `any` Cleanup

**What to type and where:**

#### `src/pages/agency/AgencyClients.tsx`
- `limits` state (`useState<any>`) → create a `SubscriptionLimits` interface:
  ```typescript
  interface SubscriptionLimits {
    current_clients: number | null;
    custom_max_clients: number | null;
    is_custom_limits: boolean | null;
    subscription_plans: { max_clients: number } | null;
  }
  ```
- `clients.map((c: any) => c.id)` — already typed from the query hook, remove the `as any` cast (clients already returns the typed result from `useAgencyClients`)

#### `src/pages/agency/AgencySettings.tsx`
- `agency` state (`useState<any>`) → create a local `AgencyRow` interface matching the columns fetched:
  ```typescript
  interface AgencyRow {
    id: string;
    name: string;
    slug: string;
    support_email: string | null;
    logo_light_url: string | null;
    logo_dark_url: string | null;
    full_logo_light_url: string | null;
    full_logo_dark_url: string | null;
    favicon_light_url: string | null;
    favicon_dark_url: string | null;
    whitelabel_domain: string | null;
  }
  ```
- Replace `useState<any>(null)` with `useState<AgencyRow | null>(null)`

#### `src/pages/client/Conversations.tsx`
- `agentConfig` from `useAgentConfig` hook returns `any` by default → the hook itself returns from `data?.config || {}`. Add the `AgentConfig` interface (as specified in the prompt) to this file and assert the return type of `useAgentConfig` or cast at the usage site.
  Actually: update `useAgentConfig.ts` to return `AgentConfig` instead of `any`:
  ```typescript
  interface AgentConfig {
    custom_tracked_variables?: Array<{ voiceflow_name: string; display_name: string } | string>;
    widget_settings?: {
      functions?: {
        conversation_tags?: Array<{ id: string; label: string; color: string; enabled: boolean }>;
      };
    };
    auto_end_time?: number;
    [key: string]: unknown;
  }
  ```

#### `src/components/Sidebar.tsx`
- `clientPermissions` state (`useState<any>`) → create an interface:
  ```typescript
  interface ClientPermissions {
    conversations?: boolean;
    transcripts?: boolean;
    analytics?: boolean;
    knowledge_base?: boolean;
    settings?: boolean;
    [key: string]: boolean | undefined;
  }
  ```
- Line 30: `Settings as any` → remove the cast; `Settings` from lucide-react is already a valid `LucideIcon`, it just needs the nav item array to be typed properly:
  ```typescript
  const agencyNavigation: Array<{ name: string; href: string; icon: React.ComponentType<any>; permissionKey: string }> = [...]
  ```

#### `src/hooks/useClientAgentContext.tsx`
- The `(a.agents as any).id` pattern — add an interface for the Supabase join response:
  ```typescript
  interface AgentAssignmentRow {
    agent_id: string;
    sort_order: number;
    agents: {
      id: string;
      name: string;
      provider: string;
      status: string;
    } | null;
  }
  ```
  Then type the `data` from Supabase as `AgentAssignmentRow[]` and remove the `as any` casts.

---

### Part 2: Console Statement Cleanup

The search shows console statements exist in src files. Files to clean in the **src** directory (edge function files are left alone — console.log is fine in Deno edge functions):

**Files to clean (remove `console.log`, keep `console.error` only in catch blocks):**

1. **`src/hooks/useMultiTenantAuth.tsx`**
   - Remove all `console.log('[Auth] ...')` lines (lines 136, 142, 156, 177, 208, 285)
   - Remove `console.log('[Preview] ...')` lines
   - Keep `console.error` lines in catch blocks (lines 190, 219, 340, 363) — these are genuine error handlers
   - Line 280: `console.error('Preview session expired')` — this is flow info, not an error. Remove it (the navigate already handles the UX)

2. **`src/components/AgencyProtectedRoute.tsx`**
   - Remove `console.log('[AgencyProtectedRoute] Loading state: ...')` block

3. **`src/components/agent-management/voiceflow/VoiceflowSettings.tsx`**
   - Remove lines with `console.log("Delete success callback triggered")` and `console.log("Navigating to /admin/agents")`

4. **Any other src/ files** matching the pattern — using targeted file reads to confirm and clean each one listed in the prompt:
   - `src/components/agent-management/AgentDeletionDialog.tsx` — already shown in context: has 23 statements. All `console.log` removed; keep `console.error` only in catch block
   - `src/hooks/useBranding.tsx` — remove the favicon debug log block
   - All other files listed in the prompt (Transcripts, Conversations, AgencyBilling, etc.)

**Rule applied consistently:**
- `console.log(...)` → delete the line entirely
- `console.error(...)` in a `catch` block → keep
- `console.error(...)` outside a catch block (used as flow logging) → delete
- `console.warn(...)` → delete

---

### Part 3: Auth Hook Consolidation

**Current situation:**
- `useAuth` in `src/hooks/useAuth.tsx`: standalone auth with its own `AuthProvider` (creates a second, redundant Supabase auth subscription)
- `useMultiTenantAuth` in `src/hooks/useMultiTenantAuth.tsx`: the real auth system with full profile, userType, preview mode, etc.
- `App.tsx`: **both** `<MultiTenantAuthProvider>` and `<AuthProvider>` are mounted, meaning two parallel auth state machines run simultaneously

**Usage audit** (from the search results):
Files that import `useAuth`:
- `src/components/ProtectedRoute.tsx` — uses `user`, `profile`, `loading`
- `src/components/AdminPreviewBanner.tsx` — uses `profile`
- `src/pages/Settings.tsx` — uses `user`
- `src/App.tsx` — imports `AuthProvider` 
- `src/components/Sidebar.tsx` — uses `profile`, `signOut`
- `src/hooks/useClientAgentContext.tsx` — uses `user`, `profile`
- `src/pages/Auth.tsx` — uses `user`, `profile`
- `src/hooks/useTheme.tsx` — uses `user`, `profile`
- `src/components/analytics/AnalyticsDashboard.tsx` — uses `profile`

All of these only use the fields `user`, `session`, `profile`, `loading`, `signOut` — a strict subset of what `useMultiTenantAuth` already provides.

**The fix:**

Rewrite `src/hooks/useAuth.tsx` to be a thin wrapper:

```typescript
import { useMultiTenantAuth } from './useMultiTenantAuth';

export function useAuth() {
  const { user, session, profile, loading, signOut } = useMultiTenantAuth();
  return { user, session, profile, loading, signOut };
}

// Keep AuthProvider as a no-op passthrough so App.tsx doesn't break
// while we remove it in the same commit
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

Then in `App.tsx`, remove the `<AuthProvider>` wrapper entirely (it's now a no-op, but removing it keeps the tree clean).

**Profile shape compatibility:** The `profile` from `useMultiTenantAuth` is `MultiTenantProfile` which has all the fields of the old `Profile` interface (`id`, `email`, `full_name`, `role`) plus extra fields (`user_type`, `agency`, `first_name`, `last_name`). Since TypeScript is structural, components that only read `profile.role`, `profile.full_name`, etc. will continue to work without any changes.

**One important note:** `useClientAgentContext.tsx` uses `profile` from `useAuth()` and checks `profile?.role`. The `MultiTenantProfile` has `role: 'admin' | 'client'` — same shape. No changes needed to call sites.

`useTheme.tsx` reads `user` and `profile` from `useAuth()` — same fields, still works.

---

### Summary of File Changes

| File | Change |
|---|---|
| `src/hooks/useAuth.tsx` | Rewrite as thin wrapper around `useMultiTenantAuth` |
| `src/App.tsx` | Remove `<AuthProvider>` wrapper (now no-op, keeping tree clean) |
| `src/pages/agency/AgencyClients.tsx` | Type `limits` state; remove `as any` on clients map |
| `src/pages/agency/AgencySettings.tsx` | Type `agency` state with `AgencyRow` interface |
| `src/hooks/queries/useAgentConfig.ts` | Add `AgentConfig` return type |
| `src/components/Sidebar.tsx` | Type `clientPermissions` state; fix `Settings as any` cast |
| `src/hooks/useClientAgentContext.tsx` | Add `AgentAssignmentRow` interface; remove `as any` casts |
| `src/hooks/useMultiTenantAuth.tsx` | Remove all `console.log` lines; keep `console.error` in catch |
| `src/components/AgencyProtectedRoute.tsx` | Remove `console.log` block |
| `src/components/agent-management/voiceflow/VoiceflowSettings.tsx` | Remove 2 `console.log` lines |
| `src/components/agent-management/AgentDeletionDialog.tsx` | Remove all `console.log` lines; keep catch-block `console.error` |
| `src/hooks/useBranding.tsx` | Remove favicon debug log block |
| Other files from the priority list | Remove `console.log` throughout; keep `console.error` in catch |

**What doesn't change:** Edge function files (Deno), all UI/layout, route definitions, RLS policies, provider hierarchy structure (except removing the now-redundant `AuthProvider` wrapper), `useClientAgentContext` logic beyond the typing fix, analytics hooks.
