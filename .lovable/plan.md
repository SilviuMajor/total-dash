

## Fix: Auto-end impersonation sessions on admin pages

### Problem
When a super admin starts an agency impersonation session, bridge `sessionStorage` values (`preview_mode=agency`, `preview_agency=...`) are set. If the user navigates back to `/admin/*` without explicitly ending the session, these bridge values cause `useMultiTenantAuth` to resolve `userType` as `agency` instead of `super_admin`. `AdminProtectedRoute` then redirects to `/admin/login`, producing a blank screen loop.

There is also an orphaned session in the database right now (`b17d9c48-3ba6-4ff2-ae0c-469cc4633472`) that will be picked up on every page load.

### Solution: Two-layer auto-cleanup

**1. AdminProtectedRoute detects impersonation and auto-ends it**

Modify `src/components/AdminProtectedRoute.tsx` to:
- Import and use `useImpersonation`
- Wait for `impersonationLoading` before rendering
- If the user is a super admin AND has an active impersonation session, call `endImpersonation()` automatically and clean up bridge values
- This ensures navigating to any `/admin/*` route always exits impersonation cleanly

**2. useMultiTenantAuth preserves super_admin identity during impersonation**

The root issue is that bridge values override `userType`. Modify `src/hooks/useMultiTenantAuth.tsx` so that when `preview_mode` is set but the authenticated user is a super admin, `userType` stays `super_admin` (with preview context loaded as overlay data, not as identity replacement). This is a safety net — even if cleanup fails, admin routes still work.

**3. Clean up the orphaned DB session**

Run a one-time cleanup via the edge function, or have the `restoreSession` logic in `useImpersonation` detect that the user is on `/admin/*` and auto-end the session during restore.

### Files to change

1. **`src/components/AdminProtectedRoute.tsx`** — Add `useImpersonation` hook, wait for loading, auto-end session when detected on admin routes
2. **`src/hooks/useImpersonation.tsx`** — Add route-aware cleanup in `restoreSession`: if current path starts with `/admin/` and there's an active session, end it automatically
3. **`src/hooks/useMultiTenantAuth.tsx`** — Ensure `setUserType('super_admin')` is always called for super admins regardless of preview bridge values (the bridge should set overlay context, not change identity)

### Technical details

In `AdminProtectedRoute.tsx`:
```text
- Import useImpersonation
- Destructure { isImpersonating, endImpersonation, loading: impersonationLoading }
- Add loading guard: if (loading || impersonationLoading) show spinner
- Add auto-end: if (userType === 'super_admin' && isImpersonating) call endImpersonation() in useEffect
- If userType resolves correctly after cleanup, render children
```

In `useImpersonation.tsx` restoreSession:
```text
- Check window.location.pathname
- If starts with '/admin' and user is super_admin, auto-end session + cleanup bridge
- This handles the case where user manually types /admin URL or bookmarks it
```

In `useMultiTenantAuth.tsx`:
```text
- In the user type resolution logic, check super_admin FIRST (already does this)
- After setUserType('super_admin'), do NOT let the preview bridge override it
- The bridge event listener should set preview overlay state but never change userType away from super_admin
```

