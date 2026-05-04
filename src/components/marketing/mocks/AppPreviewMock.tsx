import { Pin, Paperclip, Search, MessageSquare, FileText, BarChart3, BookOpen, Users, Settings, Sparkles, Send, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "with_ai" | "waiting" | "in_handover" | "aftercare" | "needs_review" | "resolved";

const STATUS: Record<Status, { dot: string; label: string }> = {
  with_ai: { dot: "bg-[hsl(var(--mk-status-with-ai))]", label: "With AI" },
  waiting: { dot: "bg-[hsl(var(--mk-status-waiting))]", label: "Waiting" },
  in_handover: { dot: "bg-[hsl(var(--mk-status-handover))]", label: "In handover" },
  aftercare: { dot: "bg-[hsl(var(--mk-status-aftercare))]", label: "Aftercare" },
  needs_review: { dot: "bg-[hsl(var(--mk-status-needs-review))]", label: "Needs review" },
  resolved: { dot: "bg-[hsl(var(--mk-status-resolved))]", label: "Resolved" },
};

type Item = {
  initials: string;
  name: string;
  status: Status;
  department: string;
  preview: string;
  time: string;
  pinned?: boolean;
  attachment?: boolean;
  active?: boolean;
  unread?: number;
};

const ITEMS: Item[] = [
  { initials: "AB", name: "Aisha Bello", status: "in_handover", department: "Returns", preview: "The courier came but didn't take the parcel — they said the label was…", time: "now", pinned: true, active: true, unread: 2 },
  { initials: "TC", name: "Tom Carter", status: "waiting", department: "Sales", preview: "Can someone confirm if the bundle includes the larger pillow?", time: "2 min" },
  { initials: "MR", name: "Marta Rodríguez", status: "in_handover", department: "Support", preview: "Thanks for the update — I'll wait for the replacement to arrive.", time: "6 min", attachment: true },
  { initials: "JK", name: "James Kim", status: "with_ai", department: "Sales", preview: "What's the difference between the Classic and the Pro version?", time: "9 min" },
  { initials: "PG", name: "Priya Gupta", status: "aftercare", department: "Returns", preview: "Started a return for order TD-48201.", time: "12 min" },
  { initials: "DS", name: "Daniel Schmidt", status: "needs_review", department: "Support", preview: "Demanded refund despite outside-policy purchase date.", time: "32 min" },
  { initials: "LH", name: "Linnea Holm", status: "resolved", department: "Sales", preview: "Sorted, thank you. Lovely service.", time: "1 h" },
];

const SIDEBAR = [
  { icon: MessageSquare, label: "Conversations", active: true, badge: 12 },
  { icon: FileText, label: "Transcripts" },
  { icon: BarChart3, label: "Analytics" },
  { icon: BookOpen, label: "Knowledge base" },
  { icon: Users, label: "Team" },
  { icon: Settings, label: "Settings" },
];

export const AppPreviewMock = () => {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/10">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(0_0%_82%)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(0_0%_82%)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(0_0%_82%)]" />
        </div>
        <div className="ml-2 flex h-5 flex-1 items-center justify-center rounded-md bg-background px-3 text-[10px] font-medium text-muted-foreground">
          dashboard.fiveleaf.co.uk/conversations
        </div>
      </div>

      <div className="grid grid-cols-[44px_minmax(0,200px)_minmax(0,1fr)] md:grid-cols-[52px_minmax(0,260px)_minmax(0,1fr)] lg:grid-cols-[56px_minmax(0,300px)_minmax(0,1fr)_minmax(0,220px)] h-[460px]">
        {/* Sidebar rail */}
        <div className="flex flex-col items-center gap-1 border-r border-border bg-muted/30 py-3">
          <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
            <span className="text-[11px] font-bold">FL</span>
          </div>
          {SIDEBAR.map((s) => (
            <div
              key={s.label}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-md",
                s.active ? "bg-foreground text-background" : "text-muted-foreground"
              )}
              title={s.label}
            >
              <s.icon className="h-4 w-4" />
              {s.badge !== undefined && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background">
                  {s.badge}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Conversation list */}
        <div className="flex flex-col border-r border-border">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <div>
              <div className="text-xs font-semibold text-foreground">Conversations</div>
              <div className="text-[10px] text-muted-foreground">12 active · 3 waiting</div>
            </div>
            <div className="flex items-center gap-1">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
          <div className="flex gap-1 border-b border-border px-3 py-1.5 overflow-x-auto">
            {(["With AI", "Waiting", "Handover", "Aftercare"] as const).map((f, i) => (
              <span
                key={f}
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  i === 2 ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                )}
              >
                {f}
              </span>
            ))}
          </div>
          <ul className="flex-1 divide-y divide-border overflow-hidden">
            {ITEMS.map((it, idx) => (
              <li
                key={idx}
                className={cn(
                  "flex items-start gap-2.5 px-3 py-2.5",
                  it.active && "bg-muted/60",
                  it.pinned && !it.active && "bg-foreground/[0.03]"
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-[10px] font-semibold text-foreground">
                  {it.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium text-foreground">{it.name}</span>
                    {it.pinned && <Pin className="h-2.5 w-2.5 shrink-0 text-foreground" fill="currentColor" />}
                    <span className="ml-auto text-[10px] text-muted-foreground marketing-tnum">{it.time}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-foreground">
                      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS[it.status].dot)} />
                      {STATUS[it.status].label}
                    </span>
                    <span className="rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                      {it.department}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">
                    {it.attachment && <Paperclip className="mr-1 inline h-2.5 w-2.5" />}
                    {it.preview}
                  </p>
                </div>
                {it.unread !== undefined && (
                  <span className="mt-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background">
                    {it.unread}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Transcript / handover panel */}
        <div className="flex flex-col bg-background">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/[0.08] text-[11px] font-semibold text-foreground">AB</div>
              <div>
                <div className="text-xs font-semibold text-foreground">Aisha Bello</div>
                <div className="text-[10px] text-muted-foreground marketing-tnum">+44 7700 900 421 · Returns</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-medium text-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-full", STATUS.in_handover.dot)} />
                In handover · 02:14
              </span>
            </div>
          </div>

          {/* Transcript */}
          <div className="flex-1 space-y-2.5 overflow-hidden bg-muted/20 px-4 py-4">
            <div className="flex justify-start">
              <div className="max-w-[75%] rounded-lg rounded-tl-sm bg-card px-3 py-2 text-xs text-foreground shadow-sm">
                Hi, my parcel was meant to arrive yesterday and I've heard nothing.
              </div>
            </div>
            <div className="flex justify-end">
              <div className="max-w-[75%]">
                <div className="mb-0.5 text-right text-[9px] font-medium uppercase tracking-wide text-muted-foreground">AI · 09:42</div>
                <div className="rounded-lg rounded-tr-sm bg-foreground/[0.06] px-3 py-2 text-xs text-foreground">
                  I can help. Could you share your order number?
                </div>
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[75%] rounded-lg rounded-tl-sm bg-card px-3 py-2 text-xs text-foreground shadow-sm">
                It's TD-48201. Honestly I just want to know if it's lost.
              </div>
            </div>

            <div className="my-1 flex items-center gap-2 text-[10px] text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <ArrowRightLeft className="h-3 w-3" />
              <span>Sarah took over from AI</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="flex justify-end">
              <div className="max-w-[80%]">
                <div className="mb-0.5 text-right text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Sarah · Support</div>
                <div className="rounded-lg rounded-tr-sm bg-foreground px-3 py-2 text-xs text-background">
                  Hi Aisha — I've got you. The parcel scanned at the depot this morning, so it's still moving. I'll personally chase the courier and email you within the hour.
                </div>
              </div>
            </div>
          </div>

          {/* Composer */}
          <div className="border-t border-border bg-card px-3 py-2.5">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
              <span className="text-xs text-muted-foreground">Reply to Aisha…</span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-foreground/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-foreground">
                <Sparkles className="h-2.5 w-2.5" />
                AI enhance
              </span>
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-foreground text-background">
                <Send className="h-2.5 w-2.5" />
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1 text-[9px] text-muted-foreground">
              <span>Inactivity timeout</span>
              <span className="font-mono">04:46</span>
              <span className="ml-auto">Press ⌘↩ to send</span>
            </div>
          </div>
        </div>

        {/* Right details panel — hidden on small */}
        <div className="hidden flex-col border-l border-border bg-muted/20 px-3 py-3 lg:flex">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Customer</div>
          <div className="mt-2 space-y-1.5 text-[11px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Order</span><span className="font-mono text-foreground">TD-48201</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="text-foreground">Pro</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">First seen</span><span className="text-foreground">12 Apr</span></div>
          </div>

          <div className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tags</div>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="rounded-md bg-[hsl(var(--mk-status-waiting))]/15 px-1.5 py-0.5 text-[9px] font-medium text-[hsl(var(--mk-status-waiting))]">VIP</span>
            <span className="rounded-md bg-[hsl(var(--mk-status-aftercare))]/15 px-1.5 py-0.5 text-[9px] font-medium text-[hsl(var(--mk-status-aftercare))]">Refund req.</span>
            <span className="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">+ add</span>
          </div>

          <div className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</div>
          <div className="mt-2 space-y-1.5">
            <div className="rounded-md border border-border bg-background px-2 py-1 text-[10px] text-foreground">Transfer department</div>
            <div className="rounded-md border border-border bg-background px-2 py-1 text-[10px] text-foreground">End handover…</div>
            <div className="rounded-md border border-border bg-background px-2 py-1 text-[10px] text-foreground">Mark resolved</div>
          </div>

          <div className="mt-auto border-t border-border pt-3 text-[9px] text-muted-foreground">
            Live · realtime updates
          </div>
        </div>
      </div>
    </div>
  );
};
