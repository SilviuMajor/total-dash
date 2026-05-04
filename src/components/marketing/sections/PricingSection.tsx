import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <section id="pricing" className="border-b border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Simple pricing for agencies.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            All plans include the full platform. Pricing details coming soon — get in touch and we'll work out what fits.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TIERS.map((tier) => (
            <Card
              key={tier.name}
              className={cn(
                "flex flex-col",
                tier.highlighted && "border-primary shadow-lg"
              )}
            >
              <CardHeader>
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="space-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
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
                  <Link to="/contact">Contact us</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 text-center sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Looking to start? 14-day free trial available. No credit card required.
          </p>
          <Button asChild size="sm">
            <Link to="/signup">Start free trial</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
