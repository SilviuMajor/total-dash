const ITEMS = [
  { title: "Your domain", body: "app.youragency.com, not ours." },
  { title: "Your branding", body: "Logo, colours, login pages." },
  { title: "Your pricing", body: "You set the rate. Your invoices. Your margin." },
  { title: "Your data", body: "UK-hosted. Tenant-isolated. Yours to export." },
];

export const WhiteLabelSection = () => {
  return (
    <section className="border-b border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Your platform. Not ours.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          A genuinely white-labelled product, not a co-branded reseller link.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((it) => (
            <div key={it.title} className="rounded-lg border border-border bg-card p-5">
              <h3 className="text-base font-semibold text-foreground">{it.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
