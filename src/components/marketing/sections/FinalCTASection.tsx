import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const FinalCTASection = () => {
  return (
    <section className="bg-primary">
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-primary-foreground sm:text-4xl">
          Ship the platform your clients have been asking for.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-primary-foreground/80 sm:text-lg">
          Start your 14-day free trial or get in touch.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="secondary">
            <Link to="/signup">Start free trial</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <Link to="/contact">Contact us</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
