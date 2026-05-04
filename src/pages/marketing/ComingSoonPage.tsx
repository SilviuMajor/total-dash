import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function ComingSoonPage() {
  return (
    <div data-marketing="true" className="min-h-screen bg-background text-foreground antialiased">
      <MarketingNav />
      <main className="mx-auto max-w-xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <Card>
          <CardContent className="py-12 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Free trial signup is coming soon.
            </h1>
            <p className="mt-4 text-muted-foreground">
              We're finalising the trial flow. In the meantime, get in touch and we'll set you up manually.
            </p>
            <div className="mt-8">
              <Button asChild>
                <Link to="/contact">Contact us</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <MarketingFooter />
    </div>
  );
}
