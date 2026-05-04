import { Check } from "lucide-react";
import { HandoverMock } from "@/components/marketing/mocks/HandoverMock";

const BULLETS = [
  "Pending, active, and completed handover lifecycle",
  "Inactivity and timeout timers with configurable thresholds",
  "Manual takeover with full Voiceflow context preserved",
  "Re-escalation across departments with transfer history",
  "Resolution criteria configurable per agent",
  "Multi-handover for complex tickets",
];

export const HandoverSection = () => {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Most AI platforms hide the human handoff. We treat it as the most important part of the conversation.
            </h2>
            <p className="mt-6 text-base text-muted-foreground">
              AI handles the easy stuff. Humans handle the complex, the emotional, the high-stakes. The hard part is the system that connects the two cleanly. That system is TotalDash.
            </p>

            <ul className="mt-8 space-y-3">
              {BULLETS.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Check className="h-3 w-3 text-primary" />
                  </span>
                  <span className="text-sm text-foreground">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:pl-8">
            <HandoverMock />
          </div>
        </div>
      </div>
    </section>
  );
};
