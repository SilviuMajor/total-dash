---
name: outstanding-item
description: Work an item from OUTSTANDING.md, the TotalDash backlog. Use this skill whenever Silv mentions outstanding items, the backlog, "the next item", "what's next", references a specific backlog ID like N5/C1/I3, or asks to work / tackle / pick up / continue an item. Do NOT trigger when Silv is clearly discussing something else or working on ad-hoc / exploratory tasks unrelated to the backlog.
---

# Outstanding Item Workflow

`OUTSTANDING.md` at the repo root is the TotalDash backlog. Items are tiered (Tier 1 = pre-migration must-haves, Tier 2 = strong wants, Tier 3 = parked). Each has an ID like N5, C1, or I3, a problem description, decisions already made, open questions, and files it touches. Some link to longer spec docs.

This skill defines what's specific to working a backlog item. The general plan-mode workflow (clarify → plan → approve → execute → commit) is in `CLAUDE.md` and applies as normal.

## Picking the item

Read `OUTSTANDING.md`. If Silv referenced a specific ID, use that item. Otherwise, take the topmost open item in Tier 1; if Tier 1 is empty, Tier 2; etc. State which item you've picked, read the full entry, and read any linked spec doc.

If the entry is ambiguous or sparse, say so — don't fabricate detail.

## Clarifying

The clarify phase is non-negotiable for backlog items even when they look small. Backlog entries are summaries — they always omit something. Ask 2-5 logic questions about edge cases, conflicts, scope of existing-vs-new data, or UX choices the entry left open.

If after reading you genuinely have no questions, say so explicitly and move to plan.

## Testing guidance

After planning and implementation, provide testing guidance.

## After testing confirmation and execution and edit/tweaks: update OUTSTANDING.md

Once the code work is committed and pushed:

1. Find the item's entry in `OUTSTANDING.md`.
2. Move it to the **Completed** section at the bottom, preserving content.
3. Add a one-line note above the moved entry:
   `**Completed:** [date] — [short SHA] — [1 sentence on what changed]`
4. If during execution you noticed follow-up work that wasn't in scope, do **not** auto-add it. List those items at the end of your reply under "Flagged for backlog" and ask Silv whether to add them.

Commit the doc update separately with message `docs: mark [item ID] complete`. Push.

## Final report

Tell Silv: what was done, both commit hashes (code + doc), and anything flagged for the backlog awaiting his decision.
