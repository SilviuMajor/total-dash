import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ConversationsMock } from "@/components/marketing/mocks/ConversationsMock";

export const HeroSection = () => {
  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              The white-label customer service dashboard for AI agencies.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
              Wrap your Voiceflow or Retell bots in a multi-tenant dashboard your clients log into. Your brand. Your domain. Your platform.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/signup">Start free trial</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="/agency/login">Login</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              14-day free trial. No credit card required.
            </p>
          </div>

          <div className="lg:pl-8">
            <ConversationsMock />
          </div>
        </div>
      </div>
    </section>
  );
};
