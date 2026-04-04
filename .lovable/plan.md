

## Fix: `beforeunload` beacon kills newly started impersonation sessions

### Root cause

When the overlay calls `handleViewAgency`, it does:
1. `await startImpersonation(...)` — creates DB session, sets `activeSession` state, stores session ID in sessionStorage
2. `window.location.href = "/agency/clients"` — triggers a hard page reload

The problem: `startImpersonation` updates `activeSession`, which triggers the `useEffect` at line 221 that registers a `beforeunload` listener for the new session. When `window.location.href` fires immediately after, the browser fires `beforeunload`, which calls `navigator.sendBeacon` to end the session that was just created.

On reload, `restoreSession` finds the session already ended, cleans up bridge values, and `AgencyProtectedRoute` redirects to `/agency/login`.

This also explains the "heyb" (HeyB client) white screen — the same race happens for client impersonation, where the session is ended by the beacon, and `ProtectedRoute` redirects a super admin with no active preview to `/admin/agencies`.

The multiple `end-impersonation` calls at 15:54:22 and 15:54:40 (5-7 concurrent) confirm this: the beacon, the `restoreSession` auto-end, and cleanup logic all fire in rapid succession.

### Solution

**1. Delay `beforeunload` registration** (`src/hooks/useImpersonation.tsx`)

Add a grace period to the `beforeunload` listener. When `activeSession` changes, wait 2 seconds before registering the unload handler. If the page navigates away within that window (as it does during `window.location.href`), the handler is never registered and the beacon never fires.

```text
useEffect:
  if (!activeSession) return;
  let handler: (() => void) | null = null;
  const timer = setTimeout(() => {
    handler = () => {
      sendBeacon to end-impersonation
    };
    window.addEventListener('beforeunload', handler);
  }, 2000);
  return () => {
    clearTimeout(timer);
    if (handler) window.removeEventListener('beforeunload', handler);
  };
```

**2. Clean up the currently orphaned session**

There is an active `client_full` session (`333ed8b3`) in the database that should be ended.

### Files to change

1. **`src/hooks/useImpersonation.tsx`** — Add 2-second delay before registering `beforeunload` handler (lines 221-235)
2. **Database** — End the orphaned active session

### Why this is safe

The 2-second delay only affects the `beforeunload` beacon. All other termination layers (logout cleanup, admin route auto-end, server-side 30-minute cron, 4-hour client timeout) remain active. The only scenario not covered during the 2-second window is "user closes tab within 2 seconds of starting impersonation" — which would be caught by the cron job within 30 minutes.

