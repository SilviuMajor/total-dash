import { Bot, Hand, Users, Coffee, AlertTriangle, CheckCircle2, ArrowRight, Clock, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Stage = {
  key: string;
  label: string;
  icon: typeof Bot;
  dotVar: string;
  description: string;
};

const STAGES: Stage[] = [
  { key: "with_ai", label: "With AI", icon: Bot, dotVar: "--mk-status-with-ai", description: "Voiceflow handles it." },
  { key: "waiting", label: "Waiting", icon: Clock, dotVar: "--mk-status-waiting", description: "Handover requested." },
  { key: "in_handover", label: "In handover", icon: Hand, dotVar: "--mk-status-handover", description: "Human is replying." },
  { key: "aftercare", label: "Aftercare", icon: Coffee, dotVar: "--mk-status-aftercare", description: "Bot finishes the wrap-up." },
  { key: "needs_review", label: "Needs review", icon: AlertTriangle, dotVar: "--mk-status-needs-review", description: "Flagged for the team." },
  { key: "resolved", label: "Resolved", icon: CheckCircle2, dotVar: "--mk-status-resolved", description: "With reason and duration." },
];

export const WorkflowMock = () => {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Conversation lifecycle</div>
          <div className="mt-0.5 text-sm font-semibold text-foreground">Six states. One queue. Auditable transitions.</div>
        </div>
        <span className="hidden rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
          Atomic · timer-aware
        </span>
      </div>

      <ol className="mt-6 grid gap-2 md:grid-cols-6">
        {STAGES.map((s, i) => (
          <li
            key={s.key}
            className="relative rounded-lg border border-border bg-background p-3"
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{ backgroundColor: `hsl(var(${s.dotVar}) / 0.15)` }}
              >
                <s.icon className="h-3 w-3" style={{ color: `hsl(var(${s.dotVar}))` }} />
              </span>
              <span className="text-[11px] font-semibold text-foreground">{s.label}</span>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">{s.description}</p>
            {i < STAGES.length - 1 && (
              <ArrowRight className="absolute -right-3 top-1/2 hidden h-3 w-3 -translate-y-1/2 text-muted-foreground/60 md:block" />
            )}
          </li>
        ))}
      </ol>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3 w-3" /> Inactivity timer
          </div>
          <p className="mt-1 text-[11px] text-foreground">
            Active sessions auto-escalate after a configurable threshold without an agent reply.
          </p>
        </div>
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ArrowRightLeft className="h-3 w-3" /> Department transfer
          </div>
          <p className="mt-1 text-[11px] text-foreground">
            Move a live handover to another team mid-conversation, with the transcript and a transfer note.
          </p>
        </div>
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-3 w-3" /> Multi-handover
          </div>
          <p className="mt-1 text-[11px] text-foreground">
            One conversation, several handover sessions. Full succession history kept for audit.
          </p>
        </div>
      </div>
    </div>
  );
};
