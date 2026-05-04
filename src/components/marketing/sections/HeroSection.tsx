import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { AppPreviewMock } from "@/components/marketing/mocks/AppPreviewMock";

export const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-background">
      <div className="marketing-grid marketing-grid-fade pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-24">
        <div className="mb-10 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground" />
            For agencies running Voiceflow &amp; Retell
          </span>
        </div>

        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          The customer-service dashboard your AI agency can actually sell.
        </h1>
        <p className="mt-5 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
          Wrap your bots in a multi-tenant platform built for human handover, granular permissions, and white-label hosting. Your domain. Your brand. Your margin.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="group">
            <Link to="/signup">
              Start free trial
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="/agency/login">Login</a>
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> 14-day free trial
          </span>
          <span>No card required</span>
          <span>UK-hosted · GDPR-aligned</span>
        </div>

        <div className="mt-14 sm:mt-16 lg:mt-20">
          <AppPreviewMock />
        </div>
      </div>
    </section>
  );
};
