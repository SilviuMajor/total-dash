
## Plan: Add Handover Controls to Conversations Page

**One file modified:** `src/pages/client/Conversations.tsx` (~915 lines → ~1100 lines)

The changes follow the user's spec exactly. I'll walk through each insertion point:

---

### A. Imports (lines 1–38)

**Lucide additions** — append to the existing lucide import on line 4:
`Send, UserCheck, PhoneOff, ArrowRightLeft, Lock, Loader2, AlertTriangle, Timer`

**New component imports** — after existing imports block (~line 38):
```ts
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
```

---

### B. State variables (after line 103, after `queryClient` declaration)

Add `useAuth`, `useMultiTenantAuth`, `useClientAgentContext` calls and 12 new handover state variables.

Note: `useClientAgentContext` is already imported and already destructures `selectedAgentId, agents` — add `clientId` to that destructure on line 99.

---

### C. Three new `useEffect` hooks (after line 253, after the transcript realtime subscription)

1. Load `currentClientUserId` from `client_users` on `user?.id` change
2. Load `departments` for transfer modal on `clientId`/preview change
3. Load `pendingSession` and `activeSession` on `selectedConversation?.id` / `.status` change

---

### D. Handler functions (after `toggleTagFilter` on line 361, before `availableTags` on line 363)

Five handlers:
- `callHandoverAction` — generic edge function invoker with loading state, toast, query invalidation, session reload
- `handleSendChatMessage` — wraps `callHandoverAction('send_message')`
- `handleEndHandover(resolve)` — closes modal, calls `end_handover`
- `handleTransfer` — validates dept+note, closes modal, calls `transfer`
- `handleTakeover` — closes confirm dialog, calls `take_over`

---

### E. Chat input — middle panel (after line 748, after the Jump to Latest button, before the `</>` closing the `selectedConversation` branch)

A `flex-shrink-0` footer div containing:
- Active owner branch: `Input` + `Send` button (Enter key support, disabled during send)
- Inactive branch: lock icon + greyed-out hint text

---

### F. Handover Control Card — right panel (after line 763, as the FIRST element inside `selectedConversation ? <>`)

A Card with conditional rendering for each status:
- `with_ai` + no pending → "Take Over" button → triggers `takeoverConfirmOpen`
- `pendingSession` exists → Accept card with dept badge + timeout + Accept button
- `in_handover` + owned by me → End Handover + Transfer buttons
- `in_handover` + owned by other → read-only "being handled" card
- `aftercare` → "Mark as Resolved" button
- `needs_review` → Take Over + Mark Resolved buttons
- `resolved` → green resolved badge

---

### G. Three modals — appended just before final `</div>` at line 913

1. **End Handover Dialog** — two action buttons: "End — Keep in Aftercare" / "End & Resolve"
2. **Transfer Dialog** — dept selector (color dots) + required note textarea
3. **Takeover AlertDialog** — confirmation before proactive takeover

---

### Key implementation notes

- `clientId` is added to the existing `useClientAgentContext()` destructure (already exported by the hook)
- The `activeSession?.department_id` filter in the transfer dept list excludes the current dept
- `transcriptScrollRef` already exists — used in `handleSendChatMessage` scroll-to-bottom
- No existing UI, styling, layout, or realtime logic is altered
- No other files are touched
