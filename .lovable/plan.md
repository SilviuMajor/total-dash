
## Plan: Update Conversation Statuses for Handover System

**Files to change:** `src/pages/client/Conversations.tsx` and `src/components/MessageBubble.tsx`

---

### Conversations.tsx — 7 targeted edits

**1. Interface: Conversation (lines 40–57)**
Add `owner_id`, `department_id`, `voiceflow_user_id` fields to match the new DB schema.

**2. Interface: Transcript (lines 59–69)**
Expand `speaker` type from `'user' | 'assistant'` to include `'client_user' | 'system'`. Add `metadata` fields: `client_user_id`, `client_user_name`, `type`.

**3. Status filter pills (line 385)**
Replace `['all', 'active', 'owned', 'resolved']` with `['all', 'with_ai', 'in_handover', 'aftercare', 'needs_review', 'resolved']`. Update dot colours and label text map.

**4. Conversation card left border (lines 572–575)**
Replace `active/owned/resolved` classes with `with_ai/in_handover/aftercare/needs_review/resolved` and their new colours.

**5. Conversation card status badge (lines 614–621)**
Replace old status class mappings with new 5-status mappings + label map.

**6. Right panel status Select (lines 776–804)**
Replace 3 SelectItems (`active`, `owned`, `resolved`) with 5 new items. Change default value from `'active'` to `'with_ai'`.

**7. Bulk status DropdownMenu (lines 502–510)**
Replace 3 items with 5 new items matching new statuses/colours.

**8. Transcript speaker detection (lines 685–686)**
Replace the `toLowerCase().includes()` logic with explicit equality checks: `'user'→user`, `'client_user'→assistant`, `'system'→assistant`, else `assistant`.

---

### MessageBubble.tsx — 1 edit

**Interface `MessageBubbleProps` (line 10)**
Expand `speaker` type from `'user' | 'assistant'` to `'user' | 'assistant' | 'client_user' | 'system'`.
`isUser` check stays as `speaker === 'user'` — no change needed there.

---

### No changes needed
- `useConversations.ts` — uses string `eq('status', status)`, works as-is
- `useConversationMutations.ts` — passes status as string, works as-is
