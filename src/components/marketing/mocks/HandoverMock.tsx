import { Clock, ArrowRightLeft, Sparkles, Send, MoreHorizontal } from "lucide-react";

type Msg = { from: "ai" | "customer" | "agent" | "system"; body: string; meta?: string };

const MESSAGES: Msg[] = [
  { from: "customer", body: "Hi, my parcel was meant to arrive yesterday and I've heard nothing." },
  { from: "ai", body: "I can help. Could you share your order number?", meta: "AI · 09:42" },
  { from: "customer", body: "It's TD-48201. Honestly I just want to know if it's lost." },
  { from: "system", body: "Sarah took over from AI · context preserved" },
  { from: "agent", body: "Hi Aisha — I've got you. The parcel scanned at the depot this morning, so it's still moving. I'll personally chase the courier and email you within the hour.", meta: "Sarah · Support" },
];

export const HandoverMock = () => {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--mk-status-handover))]" />
          <span className="text-xs font-semibold text-foreground">Handover · Aisha Bello</span>
          <span className="text-xs text-muted-foreground">— Sarah took over 2 min ago</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-medium text-foreground marketing-tnum">
            <Clock className="h-3 w-3" />
            02:14
          </span>
          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      <div className="space-y-2.5 bg-muted/20 px-4 py-4">
        {MESSAGES.map((m, idx) => {
          if (m.from === "system") {
            return (
              <div key={idx} className="my-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <ArrowRightLeft className="h-3 w-3" />
                <span>{m.body}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            );
          }
          const isCustomer = m.from === "customer";
          return (
            <div key={idx} className={isCustomer ? "flex justify-start" : "flex justify-end"}>
              <div className={isCustomer ? "max-w-[80%]" : "max-w-[80%]"}>
                {m.meta && (
                  <div className={`mb-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground ${isCustomer ? "" : "text-right"}`}>
                    {m.meta}
                  </div>
                )}
                <div
                  className={
                    isCustomer
                      ? "rounded-lg rounded-tl-sm bg-card px-3 py-2 text-xs text-foreground shadow-sm"
                      : m.from === "ai"
                        ? "rounded-lg rounded-tr-sm bg-foreground/[0.06] px-3 py-2 text-xs text-foreground"
                        : "rounded-lg rounded-tr-sm bg-foreground px-3 py-2 text-xs text-background"
                  }
                >
                  {m.body}
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
          <button className="rounded-md border border-border bg-background px-2 py-1 font-medium text-foreground">Transfer</button>
          <button className="rounded-md border border-border bg-background px-2 py-1 font-medium text-foreground">End handover…</button>
          <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Inactivity 04:46</span>
          </span>
        </div>
      </div>
    </div>
  );
};
