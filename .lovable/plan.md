
## Plan: Agent Selector Icon + Padding + Logo Size

**Files to change:** `src/components/ClientAgentSelector.tsx` and `src/components/Sidebar.tsx`

---

### 1. ClientAgentSelector.tsx — Add Bot icon, fix height & padding

**Trigger button:**
- Import `Bot` from `lucide-react`
- Add `Bot` icon (w-4 h-4 text-muted-foreground) to the left of the agent name — always visible in the trigger
- Change button height from `h-8` to match the search bar height. The search bar uses `py-2` inside a container — the button equivalent is `h-9`
- Change padding from `px-2 py-1` to `px-2.5 py-2` for more breathing room
- The name text: change from `text-sm font-semibold` to `text-sm font-medium` to be less heavy

**Dropdown items (PopoverContent):**
- Add `Bot` icon (w-4 h-4 text-muted-foreground) to each `CommandItem`, placed before the agent name
- Remove the `Check` icon from the left (currently used to show selected) — instead, bold or highlight the selected item's name, OR keep the Check but move it to the right after the name, since the Bot icon now occupies the left slot
- Actually: keep Check on the left for accessibility, add Bot between Check and name. Layout per item: `[Check] [Bot] [Name]`

**Container in Sidebar** (`px-3 py-1` currently):
- Change to `px-3 py-1.5` to add a tiny bit more vertical room around the selector

---

### 2. Sidebar.tsx — Increase logo size

- Change logo image from `w-10 h-10` to `w-12 h-12` (48px)
- Change initials fallback from `w-10 h-10` to `w-12 h-12`
- The initials text inside: change from `text-xs` to `text-sm`
- Logo container padding `py-8` stays the same — the extra 8px of icon height fills nicely

---

### Summary of changes

| File | Change |
|---|---|
| `ClientAgentSelector.tsx` | Add `Bot` icon in trigger + each dropdown item; height `h-9`; padding `px-2.5 py-2` |
| `Sidebar.tsx` | Logo icon size `w-12 h-12`; agent selector container `px-3 py-1.5` |
