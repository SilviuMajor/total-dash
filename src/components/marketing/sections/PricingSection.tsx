import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const TIERS = [
  {
    name: "Starter",
    description: "For solo agencies and freelance specialists.",
    features: [
      "Single agency",
      "Up to 5 clients",
      "Standard branding",
      "Email support",
    ],
    highlighted: false,
  },
  {
    name: "Growth",
    description: "For agencies scaling their AI services.",
    features: [
      "Single agency",
      "Unlimited clients",
      "Full custom domain",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    description: "For high-volume agencies and resellers.",
    features: [
      "Unlimited agencies",
      "White-label everything",
      "Dedicated support",
      "SLA",
    ],
    highlighted: false,
  },
];

export const PricingSection = () => {
  return (
    <section id="pricing" className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pricing
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Built for agencies. Priced for them.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Every plan includes the full platform — no feature gates, no per-seat surprises. Final pricing is being calibrated against early customers; get in touch and we'll size something that fits.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-6",
                tier.highlighted
                  ? "border-foreground shadow-lg shadow-foreground/[0.05]"
                  : "border-border"
              )}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-semibold text-foreground">{tier.name}</h3>
                {tier.highlighted && (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
                    Most popular
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>

              <ul className="mt-6 space-y-2.5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex-1" />
              <Button
                asChild
                variant={tier.highlighted ? "default" : "outline"}
                className="mt-6 w-full"
              >
                <Link to="/contact">Talk to us</Link>
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/40 p-6 text-center sm:flex-row sm:text-left">
          <div className="flex-1">
            <p className="text-base font-semibold text-foreground">Just want to kick the tyres?</p>
            <p className="text-sm text-muted-foreground">14-day free trial available, no credit card required.</p>
          </div>
          <Button asChild size="lg">
            <Link to="/signup">Start free trial</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
