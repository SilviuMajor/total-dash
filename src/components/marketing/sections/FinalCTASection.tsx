import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const FinalCTASection = () => {
  return (
    <section className="border-t border-border">
      <div className="marketing-ink-band">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Ship the platform your clients have been asking for.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-base text-white/70 sm:text-lg">
            Start your 14-day free trial, or send us a note and we'll set you up manually this week.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary" className="group">
              <Link to="/signup">
                Start free trial
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link to="/contact">Talk to us</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
