import { Clock, ArrowRightLeft } from "lucide-react";

type Msg = { from: "ai" | "customer" | "agent"; body: string; meta?: string };

const MESSAGES: Msg[] = [
  { from: "customer", body: "Hi, my parcel was meant to arrive yesterday and I've heard nothing." },
  { from: "ai", body: "I can help with that. Could you share your order number?", meta: "AI" },
  { from: "customer", body: "It's TD-48201. Honestly I just want to know if it's lost." },
  { from: "agent", body: "Hi — Sarah here, taking over from the bot. I can see your parcel scanned at the depot this morning, so it's still moving. I'll personally chase the courier now.", meta: "Sarah · Support" },
];

export const HandoverMock = () => {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b border-border bg-primary/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Handover active</span>
          <span className="text-xs text-muted-foreground">— Sarah took over 2 min ago</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-foreground">
          <Clock className="h-3 w-3" />
          02:14
        </span>
      </div>

      <div className="space-y-3 bg-muted/30 px-4 py-4">
        {MESSAGES.map((m, idx) => {
          const isCustomer = m.from === "customer";
          return (
            <div key={idx} className={isCustomer ? "flex justify-start" : "flex justify-end"}>
              <div className={isCustomer ? "max-w-[85%]" : "max-w-[85%] text-right"}>
                {m.meta && (
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {m.meta}
                  </div>
                )}
                <div
                  className={
                    isCustomer
                      ? "rounded-lg rounded-tl-sm bg-card px-3 py-2 text-sm text-foreground shadow-sm"
                      : m.from === "ai"
                        ? "rounded-lg rounded-tr-sm bg-secondary px-3 py-2 text-sm text-secondary-foreground"
                        : "rounded-lg rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                  }
                >
                  {m.body}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
        <span className="text-xs text-muted-foreground">Press Enter to send</span>
        <button
          type="button"
          className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground"
        >
          End handover
        </button>
      </div>
    </div>
  );
};
