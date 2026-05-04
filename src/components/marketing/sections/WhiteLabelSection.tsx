import { WhitelabelMock } from "@/components/marketing/mocks/WhitelabelMock";

const POINTS = [
  { title: "Your domain", body: "Verified custom hostname via the Vercel API. dashboard.youragency.com — not ours." },
  { title: "Your branding", body: "Logos, colours, login pages, favicons. Configurable per agency, with light and dark variants." },
  { title: "Your pricing", body: "You set the rate, you keep the margin, your invoices go out. We're invisible to the customer." },
  { title: "Your data", body: "Tenant-isolated at the database. UK-hosted in Supabase London. Yours to export, end-to-end." },
];

export const WhiteLabelSection = () => {
  return (
    <section id="whitelabel" className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              White-label
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Your platform. Not ours.
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              A genuinely white-labelled product, not a co-branded reseller link. From the address bar to the email sender, your customers see your business.
            </p>

            <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
              {POINTS.map((p) => (
                <div key={p.title} className="bg-card p-5">
                  <dt className="text-sm font-semibold text-foreground">{p.title}</dt>
                  <dd className="mt-1.5 text-sm text-muted-foreground">{p.body}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="lg:sticky lg:top-24">
            <WhitelabelMock />
          </div>
        </div>
      </div>
    </section>
  );
};
