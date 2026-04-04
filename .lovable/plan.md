

## Fix: Terminate orphaned impersonation sessions and prevent blank screen on root route

### Problem
There is an active orphaned impersonation session (`b17d9c48...`, type: agency, full_access) in the database that was never ended. When you load `/`, `useImpersonation.restoreSession` finds it, restores it, and sets bridge `sessionStorage` values (`preview_mode=agency`). This puts `useMultiTenantAuth` into preview mode, so `ProtectedRoute` treats you as a super admin in preview — but there is no actual client/agency context loaded, resulting in a blank screen.

The auto-end logic only triggers on `/admin/*` routes, not on `/`.

### Solution

**1. End all orphaned sessions immediately (one-time DB cleanup)**

Run a data update to terminate the orphaned session `b17d9c48-3ba6-4ff2-ae0c-469cc4633472` and any other lingering sessions.

**2. Fix `restoreSession` to handle super admins on non-contextual routes**

In `src/hooks/useImpersonation.tsx`, extend the auto-end logic in `restoreSession`: if the user is a super admin and the current route is NOT an agency or client route (i.e., `/` or any route that doesn't match the impersonation context), auto-end the session instead of restoring it. Specifically:
- If on `/admin/*` → auto-end (already works)
- If on `/` and user is super admin with no `preview_client` in sessionStorage → auto-end
- This prevents the "restored session with no actual context" blank screen

**3. Add a fallback redirect in `ProtectedRoute` for super admins without context**

In `src/components/ProtectedRoute.tsx`, add a guard: if `userType === 'super_admin'` and NOT in any meaningful preview mode (no `previewClient`, no impersonation with a client), redirect to `/admin/agencies` instead of rendering blank client content.

### Files to change

1. **Database** — End the orphaned session via insert/update tool
2. **`src/hooks/useImpersonation.tsx`** — Broaden auto-end in `restoreSession` to cover super admins on routes that don't match their impersonation context
3. **`src/components/ProtectedRoute.tsx`** — Add super admin fallback redirect to `/admin/agencies` when no client context exists

### Technical details

In `useImpersonation.tsx` restoreSession (~line 107):
```text
- After checking isOnAdminRoute, add: isOnRootWithNoContext check
- If user is super_admin (check super_admin_users table or pass from auth)
  and current path is '/' and session.target_type is 'agency' (no client),
  auto-end the session + cleanup bridge values
- This covers the case where a super admin lands on '/' with a stale agency session
```

In `ProtectedRoute.tsx` (~line 58-67):
```text
- Add early check: if userType === 'super_admin' && !isImpersonating && previewDepth === 'none'
  → redirect to /admin/agencies
- This ensures super admins who aren't actively previewing always land on admin pages
```

