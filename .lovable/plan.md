
## Conversations Page Upgrade — Infinite Scroll, Filters, Bulk Actions

This is a single-file upgrade to `src/pages/client/Conversations.tsx` (693 lines). The center and right panels are untouched. All new logic lives in the left panel.

---

### What exists today

- `loadConversations()`: fetches 50 conversations, replaces state entirely
- Simple search filter (client-side)
- Real-time subscription: INSERT/DELETE triggers `loadConversations()`, UPDATE patches in-place
- No pagination, no status filter, no bulk select, no sort control

---

### New State Variables

```typescript
// Infinite scroll
const [hasMore, setHasMore] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);
const cursorRef = useRef<string | null>(null);

// Filters
const [statusFilter, setStatusFilter] = useState<string>('all');
const [tagFilters, setTagFilters] = useState<string[]>([]);
const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'duration'>('desc');

// Bulk select
const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());

// Sentinel ref for IntersectionObserver
const sentinelRef = useRef<HTMLDivElement>(null);
const convListScrollRef = useRef<HTMLDivElement>(null);
```

---

### Part 1: Infinite Scroll

**Replace `loadConversations`** with a new signature:

```typescript
const loadConversations = async (cursor?: string, append = false) => {
  // Build query with sort + status filter
  let query = supabase
    .from('conversations')
    .select('*')
    .eq('agent_id', selectedAgentId!)
    .order('started_at', { ascending: sortOrder === 'asc' })
    .limit(30);

  if (sortOrder === 'duration') {
    query = supabase.from('conversations').select('*')
      .eq('agent_id', selectedAgentId!)
      .order('duration', { ascending: false })
      .limit(30);
  }

  if (cursor && sortOrder !== 'duration') {
    query = query.lt('started_at', cursor);
  }

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  const rows = (data || []) as Conversation[];

  if (append) {
    setConversations(prev => [...prev, ...rows]);
  } else {
    setConversations(rows);
  }

  if (rows.length === 30) {
    cursorRef.current = rows[rows.length - 1].started_at;
    setHasMore(true);
  } else {
    setHasMore(false);
  }
};
```

**IntersectionObserver** on a `<div ref={sentinelRef} />` placed at the bottom of the conversation list:

```typescript
useEffect(() => {
  if (!sentinelRef.current) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMore();
      }
    },
    { threshold: 0.1 }
  );
  observer.observe(sentinelRef.current);
  return () => observer.disconnect();
}, [hasMore, loadingMore, sentinelRef.current]);
```

**loadMore:**

```typescript
const loadMore = async () => {
  if (!hasMore || loadingMore || !cursorRef.current) return;
  setLoadingMore(true);
  await loadConversations(cursorRef.current, true);
  setLoadingMore(false);
};
```

**Reset on agent change / filter change:**

```typescript
useEffect(() => {
  if (selectedAgentId) {
    setConversations([]);
    cursorRef.current = null;
    setHasMore(true);
    setSelectedConversationIds(new Set());
    loadConversations();
  }
}, [selectedAgentId, statusFilter, tagFilters, sortOrder]);
```

**Real-time INSERT handling** — prepend to top without re-fetching entire list:

```typescript
if (payload.eventType === 'INSERT') {
  setConversations(prev => [payload.new as Conversation, ...prev]);
}
// DELETE: filter out
// UPDATE: patch in place (unchanged)
```

**Loading spinner** at bottom of list:

```tsx
{loadingMore && (
  <div className="flex justify-center py-3">
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
  </div>
)}
<div ref={sentinelRef} className="h-1" />
```

---

### Part 2: Status + Tag Filters + Sort

**Status pills** — above the search bar in the left panel header area:

```tsx
<div className="flex gap-1 flex-wrap">
  {(['all', 'active', 'owned', 'resolved'] as const).map(s => (
    <Button
      key={s}
      size="sm"
      variant={statusFilter === s ? 'default' : 'outline'}
      onClick={() => setStatusFilter(s)}
      className="h-7 text-xs rounded-full px-3"
    >
      {s !== 'all' && <span className={cn("w-1.5 h-1.5 rounded-full mr-1",
        s === 'active' && 'bg-green-400',
        s === 'owned' && 'bg-yellow-400',
        s === 'resolved' && 'bg-blue-400'
      )} />}
      {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
    </Button>
  ))}
</div>
```

**Tag filter chips** — below status pills, only rendered if `agentConfig?.widget_settings?.functions?.conversation_tags` has enabled entries:

```tsx
<div className="flex gap-1 flex-wrap">
  {availableTags.map(tag => (
    <Badge
      key={tag.id}
      variant={tagFilters.includes(tag.label) ? 'default' : 'outline'}
      className="cursor-pointer text-xs"
      onClick={() => toggleTagFilter(tag.label)}
      style={...color styling}
    >
      {tag.label}
    </Badge>
  ))}
</div>
```

`toggleTagFilter`: adds/removes from `tagFilters` array. Tag filtering is applied **client-side** after fetch (since JSON array containment in Supabase requires `@>` operator — client-side is simpler and works fine for 30-item pages).

**Sort dropdown** — using `DropdownMenu` with `ArrowUpDown` icon, placed next to the search input:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm" className="h-10 px-3">
      <ArrowUpDown className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => setSortOrder('desc')}>Newest first</DropdownMenuItem>
    <DropdownMenuItem onClick={() => setSortOrder('asc')}>Oldest first</DropdownMenuItem>
    <DropdownMenuItem onClick={() => setSortOrder('duration')}>Longest duration</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Search** stays client-side using `useMemo` on the loaded conversations, with 300ms debounce using `lodash.debounce`.

---

### Part 3: Bulk Actions Toolbar

**Selection on each conversation item** — add checkbox to left of content:

```tsx
<div className="flex items-start gap-2 p-3 ...">
  <Checkbox
    checked={selectedConversationIds.has(conv.id)}
    onCheckedChange={(checked) => {
      setSelectedConversationIds(prev => {
        const next = new Set(prev);
        checked ? next.add(conv.id) : next.delete(conv.id);
        return next;
      });
    }}
    onClick={(e) => e.stopPropagation()} // prevent row click
  />
  <div className="flex-1" onClick={() => setSelectedConversation(conv)}>
    ...existing content...
  </div>
</div>
```

**Select All checkbox** in panel header:

```tsx
<Checkbox
  checked={filteredConversations.length > 0 && filteredConversations.every(c => selectedConversationIds.has(c.id))}
  onCheckedChange={(checked) => {
    if (checked) setSelectedConversationIds(new Set(filteredConversations.map(c => c.id)));
    else setSelectedConversationIds(new Set());
  }}
/>
```

**Bulk toolbar** — shown when `selectedConversationIds.size > 0`, slides in above the filter bar:

```tsx
{selectedConversationIds.size > 0 && (
  <div className="p-2 bg-muted border-b border-border flex items-center gap-2 flex-wrap">
    <span className="text-sm font-medium">{selectedConversationIds.size} selected</span>
    <Button variant="ghost" size="sm" onClick={() => setSelectedConversationIds(new Set())}>
      Clear
    </Button>
    
    {/* Change Status */}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">Change Status</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => bulkUpdateStatus('active')}>Active</DropdownMenuItem>
        <DropdownMenuItem onClick={() => bulkUpdateStatus('owned')}>Owned</DropdownMenuItem>
        <DropdownMenuItem onClick={() => bulkUpdateStatus('resolved')}>Resolved</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    
    {/* Apply Tag */}
    <DropdownMenu>...</DropdownMenu>
    
    {/* Remove Tag */}
    <DropdownMenu>...</DropdownMenu>
  </div>
)}
```

**`bulkUpdateStatus`:**

```typescript
const bulkUpdateStatus = async (newStatus: string) => {
  const ids = Array.from(selectedConversationIds);
  await Promise.all(ids.map(id =>
    supabase.from('conversations').update({ status: newStatus }).eq('id', id)
  ));
  toast({ title: "Success", description: `Updated ${ids.length} conversations` });
  setSelectedConversationIds(new Set());
  // Optimistic local update
  setConversations(prev => prev.map(c => ids.includes(c.id) ? { ...c, status: newStatus } : c));
};
```

**`bulkApplyTag` / `bulkRemoveTag`:** reads each conversation's current tags from local state and patches:

```typescript
const bulkApplyTag = async (tagLabel: string) => {
  const ids = Array.from(selectedConversationIds);
  await Promise.all(ids.map(id => {
    const conv = conversations.find(c => c.id === id);
    const currentTags = conv?.metadata?.tags || [];
    if (currentTags.includes(tagLabel)) return Promise.resolve();
    const newTags = [...currentTags, tagLabel];
    return supabase.from('conversations').update({
      metadata: { ...conv?.metadata, tags: newTags }
    }).eq('id', id);
  }));
  toast({ title: "Success", description: `Tagged ${ids.length} conversations` });
  setSelectedConversationIds(new Set());
  // optimistic update to local state
};
```

---

### Layout inside the left panel

```
┌─────────────────────────┐
│ [Bulk toolbar]           │  ← conditional, bg-muted
├─────────────────────────┤
│ [Search input] [Sort ▾]  │
├─────────────────────────┤
│ [☐] All  Active  Owned   │  ← status pills + select-all checkbox
│ [Sales][Support]         │  ← tag chips (if any)
├─────────────────────────┤
│ ScrollArea               │
│  ☐ Conv item             │
│  ☐ Conv item             │
│  ...                      │
│  (loading spinner)        │
│  <sentinel div />         │
└─────────────────────────┘
```

---

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/client/Conversations.tsx` | Full rewrite of left panel logic and UI |

**No other files are touched.** No DB migrations, no edge functions, no new dependencies (lodash.debounce and Checkbox are already installed).

---

### Technical Notes

- Tag filtering is client-side on the 30 loaded items (not a Supabase query filter) — this is intentional and sufficient.
- Cursor-based pagination using `started_at` works for both `desc` and `asc` ordering. For `duration` sort, cursor is disabled and only the first 30 are shown (same behavior as before).
- The real-time INSERT now prepends to the list instead of calling `loadConversations()`, which prevents wiping the infinitely-loaded state.
- `selectedConversationIds` is cleared on agent change, filter change, and after any bulk operation.
- The `Checkbox` component is already imported in the project (`src/components/ui/checkbox.tsx`).
- `DropdownMenu` components are already available in the project.
- `ArrowUpDown` is available from `lucide-react`.
