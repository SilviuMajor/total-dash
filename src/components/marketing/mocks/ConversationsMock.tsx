import { Pin, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "with_ai" | "waiting" | "in_handover" | "resolved";

const STATUS_DOT: Record<Status, string> = {
  with_ai: "bg-green-500",
  waiting: "bg-red-500",
  in_handover: "bg-blue-500",
  resolved: "bg-gray-400",
};

const STATUS_LABEL: Record<Status, string> = {
  with_ai: "With AI",
  waiting: "Waiting",
  in_handover: "In Handover",
  resolved: "Resolved",
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
};

const ITEMS: Item[] = [
  { initials: "AB", name: "Aisha Bello", status: "in_handover", department: "Returns", preview: "Hi, the courier came but didn't take the parcel — they said the label …", time: "now", pinned: true },
  { initials: "TC", name: "Tom Carter", status: "waiting", department: "Sales", preview: "Can someone confirm if the bundle includes the larger pillow?", time: "2 min" },
  { initials: "MR", name: "Marta Rodríguez", status: "in_handover", department: "Support", preview: "Thanks for the update — I'll wait for the replacement to arrive.", time: "6 min", attachment: true },
  { initials: "JK", name: "James Kim", status: "with_ai", department: "Sales", preview: "What's the difference between the Classic and the Pro version?", time: "9 min" },
  { initials: "PG", name: "Priya Gupta", status: "with_ai", department: "Returns", preview: "I'd like to start a return, please.", time: "12 min" },
  { initials: "DS", name: "Daniel Schmidt", status: "resolved", department: "Support", preview: "All sorted, thank you very much for your help today.", time: "1 h" },
];

export const ConversationsMock = () => {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2.5">
        <span className="text-xs font-semibold text-foreground">Conversations</span>
        <span className="text-xs text-muted-foreground">12 active</span>
      </div>
      <ul className="divide-y divide-border">
        {ITEMS.map((it, idx) => (
          <li
            key={idx}
            className={cn(
              "flex items-start gap-3 px-4 py-3",
              it.pinned && "bg-primary/5"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {it.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{it.name}</span>
                {it.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" fill="currentColor" />}
                <span className="ml-auto text-xs text-muted-foreground">{it.time}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[it.status])} />
                  {STATUS_LABEL[it.status]}
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  {it.department}
                </span>
              </div>
              <p className="mt-1.5 truncate text-xs text-muted-foreground">
                {it.attachment && <Paperclip className="mr-1 inline h-3 w-3" />}
                {it.preview}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
