
## Scoped Search with Cmd+K — Per User Type

This adds a command palette to the app in two new files and modifies two existing ones. No new dependencies, no database changes, no auth logic touched.

---

### Architecture Decision: Shared State

The sidebar button and `CommandSearch` component need shared open/close state. The cleanest approach without adding Zustand state or a full context is a **custom DOM event**: `window.dispatchEvent(new CustomEvent('open-command-search'))`. The `CommandSearch` component listens for this event. This keeps the two components fully decoupled and avoids prop drilling through `App.tsx`.

---

### Files to Create

**`src/components/CommandSearch.tsx`**

A self-contained modal component. Always mounted in the app (placed in `App.tsx`), but only renders visible UI when `open === true`.

**State:**
```typescript
const [open, setOpen] = useState(false);
const [query, setQuery] = useState('');
const [results, setResults] = useState<SearchResult[]>([]);
const [loading, setLoading] = useState(false);
```

**SearchResult type:**
```typescript
type SearchResult = {
  id: string;
  category: 'conversation' | 'transcript' | 'client' | 'agent' | 'agency';
  label: string;
  sublabel?: string;
  href: string;
  icon: LucideIcon;
};
```

**Keyboard listener + custom event listener:**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen(true);
    }
  };
  const handleCustomEvent = () => setOpen(true);
  document.addEventListener('keydown', handleKeyDown);
  window.addEventListener('open-command-search', handleCustomEvent);
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('open-command-search', handleCustomEvent);
  };
}, []);
```

**User type detection** uses `useMultiTenantAuth()` to get `userType`, `previewDepth`, and `profile.agency.id`. Uses `useClientAgentContext()` to get `selectedAgentId`.

**Scoped queries** (debounced 300ms):

| User type | Query targets |
|---|---|
| `super_admin` (no preview) | `agencies` table — ilike name |
| `agency` or `previewDepth === 'agency'` | `clients` (by agency_id) + `agents` (by agency_id) |
| `client` or `previewDepth === 'client'/'agency_to_client'` | `conversations` (by agent_id, client-side filter on phone/name/email) + `text_transcripts` (by agent_id, ilike on user_name/user_email) |

For conversations, fetch the 50 most recent and filter client-side (since JSON path filtering on `metadata->variables->user_name` in Supabase `.or()` is unreliable). For transcripts, use `text_transcripts` table with `.ilike('user_name', ...)` OR `.ilike('user_email', ...)`.

**Recent items** — stored in `sessionStorage` under `search_recent`. On result select: push item to the front (max 5), then navigate with `useNavigate()`.

For client conversations, navigate to `/?conversationId=${id}` — the Conversations page already supports query params for pre-selection (or can be trivially handled on load).

**Empty state (no query):** show recent items from sessionStorage. If none, show placeholder text contextual to user type.

**Loading state:** a small spinner row below the CommandInput while `loading === true`.

**Dialog structure using existing shadcn components:**
```tsx
<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput
    placeholder={getPlaceholder()}
    value={query}
    onValueChange={setQuery}
    autoFocus
  />
  <CommandList>
    {loading && <div className="py-3 text-center text-sm text-muted-foreground">Searching...</div>}
    {!loading && query && results.length === 0 && (
      <CommandEmpty>No results for "{query}"</CommandEmpty>
    )}
    {/* Recent section when empty */}
    {!query && recentItems.length > 0 && (
      <CommandGroup heading="Recent">
        {recentItems.map(item => <CommandItem .../>)}
      </CommandGroup>
    )}
    {/* Grouped results */}
    {groupedResults.map(group => (
      <CommandGroup key={group.category} heading={group.heading}>
        {group.items.map(item => (
          <CommandItem key={item.id} onSelect={() => handleSelect(item)}>
            <item.icon className="mr-2 h-4 w-4" />
            <span>{item.label}</span>
            {item.sublabel && (
              <span className="ml-auto text-xs text-muted-foreground">{item.sublabel}</span>
            )}
          </CommandItem>
        ))}
      </CommandGroup>
    ))}
  </CommandList>
</CommandDialog>
```

The `CommandDialog` already wires up Escape and click-outside to `onOpenChange`. Arrow key navigation and Enter to select are built into cmdk.

---

### Files to Modify

**`src/components/Sidebar.tsx`**

Add `Search` to the lucide-react imports (already imported in the file).

After the logo `<div>` (line 171, closing `</div>`), add the search trigger button — **before** the Preview Mode banner:

```tsx
<button
  onClick={() => window.dispatchEvent(new CustomEvent('open-command-search'))}
  className="mx-4 mt-2 mb-1 flex items-center justify-between px-3 py-2 w-[calc(100%-2rem)] bg-muted/50 border border-border rounded-lg hover:bg-muted transition-colors"
>
  <div className="flex items-center gap-2">
    <Search className="w-4 h-4 text-muted-foreground" />
    <span className="text-sm text-muted-foreground">Search...</span>
  </div>
  <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-xs text-muted-foreground">
    {isMac ? '⌘K' : 'Ctrl K'}
  </kbd>
</button>
```

Detect Mac with `const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC')`.

**`src/App.tsx`**

Import `CommandSearch` and render it once inside the provider tree, outside `<Routes>`, after the `<BrandingWrapper>` opening tag:

```tsx
<BrandingWrapper>
  <CommandSearch />   {/* ← add here */}
  <Routes>
    ...
  </Routes>
</BrandingWrapper>
```

This means the keyboard shortcut and event listener are always active, regardless of which route is displayed.

---

### Navigation on Select

| Category | Navigate to |
|---|---|
| `conversation` | `/?conversationId={id}` |
| `transcript` | `/text-transcripts` (or `/transcripts` for Retell) |
| `client` | `/agency/clients/{id}` |
| `agent` | `/agency/agents/{id}` |
| `agency` | `/admin/agencies/{id}` |

The Conversations page already has a query-param based pre-selection pattern from the infinite scroll work, so `?conversationId=xxx` will just need a small `useEffect` in that page to auto-select on mount.

---

### Technical Notes

- `CommandDialog` from `src/components/ui/command.tsx` wraps cmdk's `Command` inside a shadcn `Dialog` — no need to build a custom modal.
- cmdk handles all keyboard navigation (arrows, Enter, Escape) natively — no extra code needed.
- Debounce is implemented with a `useRef` timeout, avoiding the need to memoize the lodash function.
- The `CommandSearch` component is placed inside `ClientAgentProvider` in the tree (via `App.tsx`) so it can safely call `useClientAgentContext()`.
- No Supabase schema changes needed — all queries use existing tables with existing RLS.
- `text_transcripts` has `user_name` and `user_email` columns directly — no JSON path needed for transcript search.
- The `conversations` table search is client-side on 50 rows to avoid Supabase JSON filter complexity.

---

### Summary of Changes

| File | Change |
|---|---|
| `src/components/CommandSearch.tsx` | New file — full command palette |
| `src/components/Sidebar.tsx` | Add search trigger button between logo and preview banner |
| `src/App.tsx` | Mount `<CommandSearch />` inside providers, outside Routes |
| `src/pages/client/Conversations.tsx` | Small addition: read `?conversationId` query param on mount to auto-select |

