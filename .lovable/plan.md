
## Error Boundaries + Consistent Loading States

This is a pure UI/UX quality improvement touching 12 files and creating 6 new ones. No data fetching, auth, or routing logic will be changed.

---

### Files to Create

**`src/components/ErrorBoundary.tsx`**
React class component. Catches errors in its subtree and shows a centered "Something went wrong" message with a `variant="outline" size="sm"` Button that calls `window.location.reload()`. No card wrapper, no illustrations.

**`src/components/skeletons/PageSkeleton.tsx`**
Generic full-page skeleton: title bar (h-8 w-48), subtitle bar (h-4 w-72), then 3 card-shaped rectangles below. Uses `<Skeleton>` from `src/components/ui/skeleton.tsx` with `animate-pulse`.

**`src/components/skeletons/ConversationsSkeleton.tsx`**
Matches the 3-column layout of the Conversations page:
- Left col: 6 rows of [circle avatar + two text lines]
- Center col: 8 message bubble placeholders alternating left/right
- Right col: 3 label+value field placeholders

**`src/components/skeletons/TableSkeleton.tsx`**
Generic table skeleton: 1 header row with 4 column placeholders + 5 body rows with 4 columns each.

**`src/components/skeletons/AnalyticsSkeleton.tsx`**
- Tab bar placeholder: row of 3 small rectangles
- 2×2 grid of 4 card placeholders, each with a title line and a larger chart area rectangle

**`src/components/skeletons/index.ts`**
Barrel export for all skeleton components.

---

### Files to Modify

**`src/App.tsx`**
Import `ErrorBoundary`. Wrap the inner content of each protected route group (the `<div className="flex h-screen...">` inside each guard, not the guard itself):
- Admin routes inner `<div>` → wrapped in `<ErrorBoundary>`
- Agency routes inner `<div>` → wrapped in `<ErrorBoundary>`
- Client routes inner `<div>` → wrapped in `<ErrorBoundary>`

Each section gets its own independent boundary.

**`src/components/ProtectedRoute.tsx`**
Replace the full-screen spinner at line 94-98 with a minimal skeleton: sidebar placeholder (`w-64 h-screen bg-muted animate-pulse`) on the left + a content area placeholder on the right.

**`src/pages/client/Analytics.tsx`**
Line ~83: replace `<p className="text-muted-foreground">Loading analytics...</p>` with `<AnalyticsSkeleton />`.

**`src/pages/client/Conversations.tsx`**
The loading state inside the left panel (lines ~401-406) already has a basic pulse. Replace the entire left-panel loading block with `<ConversationsSkeleton />` rendered at the page level (before the 3-column card) when `loading === true`. Also update the empty state message:
- "No conversations found." → "No conversations yet" with subtitle "Conversations will appear here once your chatbot starts receiving messages."

**`src/pages/agency/AgencyAgents.tsx`**
The page renders the full layout regardless of `loading`. Add a `loading` early return using `<PageSkeleton />` before the main return. Also add the empty state when `agents.length === 0 && !loading`:
- "No agents created yet" with subtitle "Create your first AI agent to get started."

**`src/pages/agency/AgencyClients.tsx`**
Add a `loading` early return using `<TableSkeleton />`.

**`src/pages/agency/AgencyAgentDetails.tsx`**
Replace the full-screen spinner (line ~109-115) with `<PageSkeleton />`.

**`src/pages/agency/AgencySettings.tsx`**
Find the loading spinner state (from `loading` flag) and replace with `<PageSkeleton />`.

**`src/pages/admin/Agencies.tsx`**
Replace the loading state (lines 112-120, which shows a plain text "Loading...") with `<TableSkeleton />`.

**`src/components/analytics/AnalyticsDashboard.tsx`**
- Line 234: replace `<div>Loading...</div>` with `<AnalyticsSkeleton />`.
- Lines 248-257: update the empty state text from "No cards yet. Add your first metric card!" to "Your analytics dashboard is empty" with subtitle "Add metric cards to start tracking your agent's performance." Keep the dashed border and the existing "Add Card" button.

---

### Technical Notes

- All skeletons use only `<Skeleton>` from the existing shadcn component — no new dependencies.
- `animate-pulse` is Tailwind built-in; no extra config needed.
- The `ErrorBoundary` must be a class component (React requirement for `componentDidCatch` / `getDerivedStateFromError`).
- No Supabase queries, RLS policies, edge functions, auth logic, or routing will be touched.
- The `ProtectedRoute` skeleton is intentionally minimal since it only shows for ~200ms on navigation.
