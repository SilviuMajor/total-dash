import { Check } from "lucide-react";
import { HandoverMock } from "@/components/marketing/mocks/HandoverMock";

const BULLETS = [
  {
    title: "Proactive takeover",
    body: "Skip the request-and-wait pattern. Agents instantly claim a conversation; Voiceflow context is preserved and resumed.",
  },
  {
    title: "Department transfers",
    body: "Move an active handover to another team mid-conversation, with the transcript and a transfer note attached.",
  },
  {
    title: "Inactivity & timeout escalation",
    body: "Configurable thresholds escalate stalled sessions automatically. Nothing rots in a queue.",
  },
  {
    title: "Resolution metadata",
    body: "End every handover with a reason, a duration, and an outcome that flows into analytics.",
  },
  {
    title: "AI Enhance in the composer",
    body: "Polish replies in-line with Claude — improve, shorten, or warm up a draft before it lands.",
  },
  {
    title: "Multi-handover succession",
    body: "One conversation, several sessions. Full succession history kept across transfers and re-takeovers.",
  },
];

export const HandoverSection = () => {
  return (
    <section className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Human handover
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Most AI platforms hide the human handoff. We treat it as the most important part of the conversation.
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              AI handles the easy stuff. Humans handle the complex, the emotional, the high-stakes. The hard part is the system that connects the two cleanly.
            </p>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {BULLETS.map((b) => (
                <li key={b.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="h-3 w-3" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{b.title}</div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{b.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:sticky lg:top-24">
            <HandoverMock />
          </div>
        </div>
      </div>
    </section>
  );
};
