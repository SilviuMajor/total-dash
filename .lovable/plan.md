
## Adopt React Query for Data Fetching

This is a refactor of the data fetching layer across 4 pages and the branding hook. No UI changes, no DB changes, no new dependencies.

---

### Files to Create

**`src/hooks/queries/useConversations.ts`**
Wraps `useInfiniteQuery` for cursor-based pagination. Accepts `agentId` and `filters` (`status`, `sortOrder`). Returns React Query's `data`, `fetchNextPage`, `hasNextPage`, `isFetching`, and `isLoading`. The `data.pages` flat structure replaces the manual `conversations[]` state.

Key params:
- `queryKey: ['conversations', agentId, filters]`
- `staleTime: 30_000`
- `getNextPageParam`: returns `lastPage[lastPage.length - 1]?.started_at` if `lastPage.length === 30`, else `undefined`. For `duration` sort, returns `undefined` always (disables pagination).
- `enabled: !!agentId`

**`src/hooks/queries/useAgentConfig.ts`**
Simple `useQuery` for the agent config used in Conversations. `queryKey: ['agent-config', agentId]`, `staleTime: 5 * 60_000`.

**`src/hooks/queries/useAgencyClients.ts`**
`useQuery` for the clients list. `queryKey: ['agency-clients', agencyId]`, `staleTime: 60_000`. Includes the secondary queries for `agent_assignments` (grouped by client_id) and `client_users` counts as separate queries in the same file:
- `useClientAgents(agencyId, clientIds)` — `queryKey: ['client-agents', agencyId, clientIds]`
- `useClientUserCounts(clientIds)` — `queryKey: ['client-user-counts', clientIds]`

**`src/hooks/queries/useAgencyAgents.ts`**
`useQuery` for the agents list. `queryKey: ['agency-agents', agencyId]`, `staleTime: 60_000`.

**`src/hooks/queries/useConversationMutations.ts`**
Mutation hooks that call `queryClient.invalidateQueries({ queryKey: ['conversations'] })` on success:
- `useUpdateConversationStatus()` — single status update
- `useUpdateConversationNote()` — metadata note update
- `useToggleConversationTag()` — add/remove a single tag
- `useBulkUpdateStatus()` — `Promise.all` across selected IDs
- `useBulkApplyTag()` — `Promise.all` with tag add
- `useBulkRemoveTag()` — `Promise.all` with tag remove

**`src/hooks/queries/useBrandingQuery.ts`**
`useQuery` that fetches both `platform_branding` (`.maybeSingle()`) and optionally the agency row in one `queryFn`. `staleTime: 10 * 60_000`. Returns `{ platformData, agencyData }`.

**`src/hooks/queries/index.ts`**
Barrel export for all query hooks.

---

### Files to Modify

#### `src/App.tsx`

Update the `QueryClient` instantiation with sensible defaults:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});
```

---

#### `src/hooks/useBranding.tsx`

Replace the manual `useEffect` + `supabase.from()` calls with `useBrandingQuery`:

- Remove `loadBranding` async function and its `useEffect`
- Call `useBrandingQuery(agencyId)` — the raw data comes back from cache
- The logo/favicon selection logic (based on `appTheme` and `systemTheme`) stays in `useBranding` — only the fetch is delegated to the query
- On query load, derive `BrandingData` from `queryData.platformData` and `queryData.agencyData` using the existing selection logic
- This stops branding from re-fetching on every dark mode toggle (currently causes a flicker)

---

#### `src/pages/agency/AgencyClients.tsx`

Replace `clients` + `loading` state and `loadClients` / `loadClientAgents` / `loadClientUsers` with query hooks:

```typescript
const { data: clients = [], isLoading } = useAgencyClients(agencyId);
const clientIds = clients.map(c => c.id);
const { data: clientAgents = {} } = useClientAgents(agencyId, clientIds);
const { data: clientUserCounts = {} } = useClientUserCounts(clientIds);
```

The `handleCreate` function calls `queryClient.invalidateQueries({ queryKey: ['agency-clients'] })` after a successful insert instead of `loadClients()`.

The `checkLimits` function stays as-is (manual fetch) since it calls an RPC and sets local state for limit display — it's not worth adding a query for this.

---

#### `src/pages/agency/AgencyAgents.tsx`

Replace `agents` + `loading` state and `loadAgents` with `useAgencyAgents`:

```typescript
const { data: agents = [], isLoading } = useAgencyAgents(agencyId);
```

The `checkLimits` function stays as-is (same reasoning as above).

---

#### `src/pages/client/Conversations.tsx`

This is the most complex change. The infinite scroll currently uses manual cursor refs and `useState` for `conversations`. We replace the data fetching layer while keeping all the UI and real-time logic:

**What gets replaced:**
- `conversations` state → `data` from `useInfiniteQuery` (flattened: `data.pages.flat()`)
- `loading` state → `isLoading` from the hook
- `hasMore` state → `hasNextPage` from the hook
- `loadingMore` state → `isFetchingNextPage` from the hook
- `cursorRef` → managed internally by React Query's `getNextPageParam`
- `loadConversations` function → `refetch` or filter/sort change triggers `queryClient.invalidateQueries`
- `loadMore` function → `fetchNextPage` from the hook
- `loadAgentConfig` function → `useAgentConfig(selectedAgentId)`

**What stays the same:**
- The `IntersectionObserver` sentinel — but instead of calling `loadMore()`, it calls `fetchNextPage()`
- The real-time Supabase subscription — on `INSERT`/`DELETE`/`UPDATE` events, we either call `queryClient.setQueryData` for optimistic updates (for UPDATE/DELETE) or `queryClient.invalidateQueries` to trigger a background refetch (for INSERT)
- All write functions (`saveNote`, `toggleTag`, `updateStatus`) get converted to use the mutation hooks, which automatically invalidate the conversations cache on success
- `bulkUpdateStatus`, `bulkApplyTag`, `bulkRemoveTag` → use the bulk mutation hooks

**The real-time + React Query integration pattern:**
```typescript
const queryClient = useQueryClient();

// In the realtime subscription:
if (payload.eventType === 'INSERT') {
  queryClient.setQueryData(['conversations', agentId, filters], (old: any) => {
    if (!old) return old;
    const firstPage = [payload.new as Conversation, ...(old.pages[0] || [])];
    return { ...old, pages: [firstPage, ...old.pages.slice(1)] };
  });
} else if (payload.eventType === 'DELETE') {
  queryClient.setQueryData(['conversations', agentId, filters], (old: any) => {
    if (!old) return old;
    return { ...old, pages: old.pages.map((page: any[]) => page.filter(c => c.id !== payload.old.id)) };
  });
} else if (payload.eventType === 'UPDATE') {
  queryClient.setQueryData(['conversations', agentId, filters], (old: any) => {
    if (!old) return old;
    return { ...old, pages: old.pages.map((page: any[]) => page.map(c => c.id === payload.new.id ? payload.new : c)) };
  });
}
```

This keeps the paginated cache consistent without triggering a full refetch.

The `useEffect` that resets the list on filter/agent change becomes:
```typescript
useEffect(() => {
  // React Query already resets when queryKey changes (agentId/filters in key)
  setSelectedConversationIds(new Set());
}, [selectedAgentId, statusFilter, tagFilters, sortOrder]);
```

---

### What stays manual (not converted)

- `checkLimits` in AgencyClients and AgencyAgents — calls Supabase RPC, used only for limit display, not worth wrapping
- `loadTranscripts` in Conversations — stays as manual fetch since it's triggered imperatively by conversation selection and benefits from the realtime subscription managing updates
- All auth hooks and context providers — explicitly excluded per the prompt
- `useAnalyticsMetrics` and `useAnalyticsTabs` — explicitly excluded per the prompt

---

### Summary of Changes

| File | Change |
|---|---|
| `src/hooks/queries/useConversations.ts` | New — `useInfiniteQuery` for conversations |
| `src/hooks/queries/useAgentConfig.ts` | New — `useQuery` for agent config |
| `src/hooks/queries/useAgencyClients.ts` | New — `useQuery` for clients + client agents + client user counts |
| `src/hooks/queries/useAgencyAgents.ts` | New — `useQuery` for agents list |
| `src/hooks/queries/useConversationMutations.ts` | New — `useMutation` hooks for all conversation writes |
| `src/hooks/queries/useBrandingQuery.ts` | New — `useQuery` for branding data |
| `src/hooks/queries/index.ts` | New — barrel export |
| `src/App.tsx` | Add `defaultOptions` to `QueryClient` |
| `src/hooks/useBranding.tsx` | Replace manual fetch with `useBrandingQuery` |
| `src/pages/agency/AgencyClients.tsx` | Replace manual fetch with `useAgencyClients` + invalidation on create |
| `src/pages/agency/AgencyAgents.tsx` | Replace manual fetch with `useAgencyAgents` |
| `src/pages/client/Conversations.tsx` | Replace manual fetch/state with `useInfiniteQuery` + mutation hooks |
