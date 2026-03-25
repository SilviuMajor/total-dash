
## Realtime Handover Support in Widget Loader

### What's being built
When the `voiceflow-interact` edge function signals an active handover (via `data.handoverActive` or `data.handoverPending`), the widget will start polling the `transcripts` table every 1.5 seconds for new `client_user` and `system` messages and render them in the chat. Polling stops when the conversation resets.

### Files to modify
- `supabase/functions/widget-loader/index.ts` — 7 targeted changes, no restructuring

---

### Change A — State variables (line 1322)
After `let clickedButtonSelections = {};` add:
```js
let isInHandover = false;
let realtimeSubscription = null;
```

---

### Change B — Two new functions after `scrollToLatestMessage` (after line 1626)
Insert `startHandoverRealtime()` and `stopHandoverRealtime()` as specified. The poller uses `fetch` against `SUPABASE_URL/rest/v1/transcripts` with `SUPABASE_ANON_KEY`, filters by `conversation_id` and `timestamp > lastTimestamp`, and appends `client_user`/`system` transcript rows as messages (mapped to `assistant`/`system` speaker).

---

### Change C — Handover detection in `sendMessage` (after line 1827–1828)
After the `conversationId` assignment block, insert the `data.handoverActive || data.handoverPending` check that sets `isInHandover = true`, calls `startHandoverRealtime()`, clears typing, and re-renders.

---

### Change D — Same handover detection in `handleButtonClick` (after line 1983)
Same block inserted after `const data = await response.json();` in the button handler (~line 1983).

---

### Change E — Call `stopHandoverRealtime()` at start of `startNewChat` (line 1862)
Prepend `stopHandoverRealtime();` as the very first line of the function body.

---

### Change F — System message CSS (after `.vf-message.user .vf-message-bubble`, line ~949)
Add new CSS block for `.vf-message.system` with centered pill style (gray background, rounded-full, no avatar, no timestamp).

---

### Change G — `renderMessages` system speaker handling (lines 1636–1655)
- Change `const isAssistant = msg.speaker === 'assistant';` to also capture `isSystem`.
- Guard the avatar `<div>` with `isAssistant && !isSystem` so system messages don't render an avatar.

---

### Technical notes
- The `transcripts` table has an RLS policy `Temp allow all authenticated to read` — but the widget is **unauthenticated** (uses anon key). The widget polls with `SUPABASE_ANON_KEY` as both `apikey` and `Authorization: Bearer`. This will only work if a public SELECT policy exists on the `transcripts` table for the anon role. If no such policy exists, the poll will get empty results (no error thrown, just silent). This is a known limitation — no migration is needed for the widget-loader changes themselves, but the RLS on `transcripts` may need a separate check if messages don't appear.
- No new edge functions or DB migrations are required.
- After the code change, the widget-loader function will be automatically redeployed.
