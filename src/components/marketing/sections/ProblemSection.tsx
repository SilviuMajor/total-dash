const POINTS = [
  {
    title: "Bots are the easy part.",
    body: "Voiceflow and Retell make great bots. They don't make the dashboard your client actually logs into — and that's where they evaluate you.",
  },
  {
    title: "Building the rest takes a year.",
    body: "Multi-tenant auth, role permissions, real-time queues, transcripts, handover lifecycles, billing. That's a SaaS, not a side feature.",
  },
  {
    title: "Reseller platforms aren't yours.",
    body: "Putting your logo on someone else's $20/month chatbot tool doesn't ship as your product. Your clients see through it within a week.",
  },
];

export const ProblemSection = () => {
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            The gap your bot doesn't fill
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Half a product wins zero contracts.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            The agencies that scale aren't the ones with the smartest bot. They're the ones with the platform around it.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {POINTS.map((p) => (
            <div key={p.title} className="bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
