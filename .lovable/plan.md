

## Add robust impersonation session termination

### Problem
Three gaps exist in session cleanup:
1. **Logout** — `handleSignOut` clears `sessionStorage` but never calls `end-impersonation`, leaving the DB session open
2. **Tab/browser close** — no cleanup at all; DB session stays open indefinitely
3. **Server-side timeout** — the 4-hour timeout is client-side only; if the tab closes, sessions linger forever

### Solution

**1. End impersonation on logout** (src/hooks/useMultiTenantAuth.tsx)

In `handleSignOut`, before calling `supabase.auth.signOut()`, check for an active impersonation session and call `end-impersonation` with `endAll: true` to terminate all sessions for this actor.

```text
handleSignOut:
  1. Clean up preview token (existing)
  2. NEW: Call end-impersonation with { endAll: true }
  3. Call supabase.auth.signOut() (existing)
  4. Clear sessionStorage (existing)
```

**2. End impersonation on tab close** (src/hooks/useImpersonation.tsx)

Add a `beforeunload` event listener that fires a `navigator.sendBeacon()` call to the `end-impersonation` edge function. `sendBeacon` is reliable during page unload (unlike `fetch`). This only fires if there's an active session.

```text
useEffect:
  if (activeSession) {
    const handleUnload = () => {
      const url = `${supabaseUrl}/functions/v1/end-impersonation`;
      navigator.sendBeacon(url, JSON.stringify({ endAll: true }));
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }
```

Note: `sendBeacon` cannot send auth headers, so the edge function will need to accept a fallback: include the session ID in the beacon body and allow ending by session ID without auth (the session ID is a UUID that acts as a capability token). Alternatively, we can pass the auth token in the body since `sendBeacon` supports `Blob` with custom content type.

**3. Server-side cron cleanup** (new edge function + cron job)

Create a `cleanup-impersonation-sessions` edge function that terminates all sessions older than 4 hours. Schedule it via `pg_cron` to run every 30 minutes.

```sql
-- The edge function will run:
UPDATE impersonation_sessions
SET ended_at = now()
WHERE ended_at IS NULL
  AND started_at < now() - interval '4 hours';
```

### Files to change

1. **`src/hooks/useMultiTenantAuth.tsx`** — Add `end-impersonation` call with `{ endAll: true }` in `handleSignOut` before sign-out
2. **`src/hooks/useImpersonation.tsx`** — Add `beforeunload` listener with `sendBeacon` to end session on tab close
3. **`supabase/functions/end-impersonation/index.ts`** — Add a fallback path that accepts `sessionId` in the body without requiring auth header (for `sendBeacon`)
4. **`supabase/functions/cleanup-impersonation-sessions/index.ts`** — New edge function that ends sessions older than 4 hours
5. **Database** — Schedule cron job to invoke the cleanup function every 30 minutes

### Technical details

**sendBeacon auth workaround**: Since `sendBeacon` cannot set headers, we'll send the session ID directly in the body. The `end-impersonation` function already supports ending by `sessionId` — we just need to make the auth check optional when a valid session ID is provided (the session ID is unguessable). This is a common pattern for unload cleanup.

**Cron setup**: Uses `pg_cron` + `pg_net` to POST to the cleanup function on a schedule. The cleanup function uses the service role key internally, no auth needed from the cron caller.

