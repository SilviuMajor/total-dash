const STATS = [
  { value: "46", unit: "Edge Functions", body: "Powering the realtime, handover, KB, billing, and widget surfaces." },
  { value: "6", unit: "Conversation states", body: "AI · waiting · handover · aftercare · review · resolved." },
  { value: "4", unit: "Permission layers", body: "Agency → client → role → user. Live-invalidated." },
  { value: "0", unit: "Polling loops", body: "Realtime everywhere. Spinners are for someone else's product." },
];

export const StatsSection = () => {
  return (
    <section className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Built for B2B from the database up
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Boring, in the best possible way.
          </h2>
        </div>

        <dl className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.unit} className="bg-card p-6">
              <dt className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight text-foreground marketing-tnum">{s.value}</span>
                <span className="text-sm font-medium text-muted-foreground">{s.unit}</span>
              </dt>
              <dd className="mt-2 text-sm text-muted-foreground">{s.body}</dd>
            </div>
          ))}
        </dl>

        <ul className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          <li className="rounded-md border border-border bg-card px-4 py-3">
            <span className="font-semibold text-foreground">UK-hosted</span> · Supabase London, eu-west-2
          </li>
          <li className="rounded-md border border-border bg-card px-4 py-3">
            <span className="font-semibold text-foreground">Tenant-isolated</span> · Row-level security at the database
          </li>
          <li className="rounded-md border border-border bg-card px-4 py-3">
            <span className="font-semibold text-foreground">Audit-logged</span> · Every administrative action recorded
          </li>
        </ul>
      </div>
    </section>
  );
};
