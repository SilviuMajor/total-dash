import { Check, Minus, X, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type Cell = "yes" | "no" | "limited";

const ROWS: Array<{
  feature: string;
  agency: Cell;
  client: Cell;
  role: Cell;
  user: Cell;
}> = [
  { feature: "View conversations",      agency: "yes",     client: "yes",     role: "yes",     user: "yes" },
  { feature: "Take over from AI",        agency: "yes",     client: "yes",     role: "yes",     user: "yes" },
  { feature: "Transfer to department",   agency: "yes",     client: "yes",     role: "limited", user: "yes" },
  { feature: "Edit canned responses",    agency: "yes",     client: "limited", role: "no",      user: "yes" },
  { feature: "Manage team",              agency: "yes",     client: "yes",     role: "no",      user: "no" },
  { feature: "Export transcripts",       agency: "yes",     client: "yes",     role: "limited", user: "limited" },
  { feature: "Settings · audit log",     agency: "yes",     client: "no",      role: "no",      user: "no" },
];

const Mark = ({ v }: { v: Cell }) => {
  if (v === "yes")
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground/[0.06]">
        <Check className="h-3 w-3 text-foreground" />
      </span>
    );
  if (v === "limited")
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground/[0.04]">
        <Minus className="h-3 w-3 text-muted-foreground" />
      </span>
    );
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground/[0.03]">
      <X className="h-3 w-3 text-muted-foreground/60" />
    </span>
  );
};

export const PermissionsMock = () => {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">Permission resolution</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Live · auto-refresh on change</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,68px))] gap-x-2 gap-y-1 px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <div></div>
        <div className="text-center">Agency</div>
        <div className="text-center">Client</div>
        <div className="text-center">Role</div>
        <div className="text-center">User</div>
      </div>

      <div className="divide-y divide-border">
        {ROWS.map((row) => (
          <div
            key={row.feature}
            className="grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,68px))] items-center gap-x-2 px-4 py-2"
          >
            <div className="text-xs text-foreground">{row.feature}</div>
            <div className="flex justify-center"><Mark v={row.agency} /></div>
            <div className="flex justify-center"><Mark v={row.client} /></div>
            <div className="flex justify-center"><Mark v={row.role} /></div>
            <div className="flex justify-center"><Mark v={row.user} /></div>
          </div>
        ))}
      </div>

      <div className="border-t border-border bg-muted/30 px-4 py-2.5 text-[10px] text-muted-foreground">
        <span className="font-semibold text-foreground">Resolution: </span>
        Agency ceiling → Client ceiling → Role template → User override.
        The lowest cap wins.
      </div>
    </div>
  );
};
