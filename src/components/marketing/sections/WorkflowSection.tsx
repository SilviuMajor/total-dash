import { WorkflowMock } from "@/components/marketing/mocks/WorkflowMock";

export const WorkflowSection = () => {
  return (
    <section id="workflow" className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Conversation lifecycle
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Six states, one queue, every transition auditable.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Most platforms collapse the AI ↔ human handover into a single flag and call it done. Total Dash treats each phase as a first-class object — with timers, transfers, and outcomes captured cleanly.
          </p>
        </div>

        <div className="mt-12">
          <WorkflowMock />
        </div>
      </div>
    </section>
  );
};
