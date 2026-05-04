const POINTS = [
  {
    title: "Your bot is half the product.",
    body: "Voiceflow and Retell make great bots. They don't make a dashboard your client logs into.",
  },
  {
    title: "Building it yourself takes a year.",
    body: "Multi-tenant auth, role permissions, real-time queues, transcripts, analytics. That's a full SaaS, not a side feature.",
  },
  {
    title: "Generic platforms aren't yours.",
    body: "Slapping your logo on a $20/month chatbot SaaS doesn't make it your product. Your clients see through it.",
  },
];

export const ProblemSection = () => {
  return (
    <section id="why" className="border-b border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Built for the gap your bot doesn't fill
        </h2>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {POINTS.map((p) => (
            <div key={p.title} className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
