

## Diagnosis: Slow initial load on admin routes due to impersonation restore

### What I found

All admin routes (`/admin/billing`, `/admin/plans`, `/admin/settings`, etc.) render correctly — I verified this by loading them in the browser. The code and routing are fine.

The white screen you're seeing is a **loading delay**, not a broken page. Here's what happens on every page load or hard refresh:

1. `AdminProtectedRoute` waits for both `loading` (auth) and `impersonationLoading` to be `false`
2. `useImpersonation.restoreSession` makes two network calls every time:
   - `is_super_admin` RPC call
   - `impersonation_sessions` table query
3. Until both complete, the page shows a spinner (or blank white if spinner is small/hidden)
4. On your connection, these calls may take 2-5 seconds, causing visible white flash

There are no orphaned sessions in the database. The code is correct. The issue is purely about **perceived load time**.

### Proposed fix: Cache super admin status and skip unnecessary DB checks

**1. Skip `is_super_admin` RPC in `restoreSession`** (`src/hooks/useImpersonation.tsx`)

Instead of calling `is_super_admin` RPC on every mount, pass the already-resolved `userType` from `useMultiTenantAuth` as context. The hook already has access to the user — we can avoid a redundant network call by accepting `userType` as a parameter or reading it from the auth context.

However, there's a timing issue: `userType` from `useMultiTenantAuth` may not be resolved yet when `restoreSession` runs. So instead:

- If there's no stored session ID in `sessionStorage` AND no bridge values (`preview_mode`, etc.), skip the DB query entirely — there's nothing to restore.
- Only query the DB if there's a `sessionStorage` session ID or if bridge values exist.

This eliminates both network calls for the common case (super admin on admin pages with no impersonation).

**2. Add early-exit in `restoreSession`** (`src/hooks/useImpersonation.tsx`)

```text
restoreSession:
  1. Check sessionStorage for stored session ID
  2. Check sessionStorage for any bridge values (preview_mode, preview_agency, etc.)
  3. If NEITHER exists → setLoading(false) and return immediately (no network calls)
  4. If stored session ID exists → proceed with current logic (query DB, auto-end if needed)
  5. If bridge values but no session ID → clean them up, setLoading(false)
```

This means on a clean admin page load, `impersonationLoading` resolves instantly (no network delay).

**3. Move the `is_super_admin` check behind the early exit** (`src/hooks/useImpersonation.tsx`)

The `is_super_admin` RPC is only needed in the `shouldAutoEnd` logic, which only matters when there IS an active session. Move it inside the branch that handles active sessions, so it's never called when there's nothing to restore.

### Files to change

1. **`src/hooks/useImpersonation.tsx`** — Restructure `restoreSession` to early-exit when no session data exists, and defer `is_super_admin` call to only when needed

### Why this works

Currently, every admin page load makes 2 network calls even when there's zero impersonation state. The fix makes those calls conditional — only when there's actually something to restore or clean up. For the 99% case (clean admin navigation), `impersonationLoading` resolves synchronously and the page renders immediately.

