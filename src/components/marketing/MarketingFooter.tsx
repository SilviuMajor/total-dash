import { Link } from "react-router-dom";

export const MarketingFooter = () => {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <p className="text-sm font-semibold text-foreground">TotalDash</p>
            <p className="mt-2 text-sm text-muted-foreground">
              The white-label customer service dashboard for AI agencies.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><a href="/#product" className="hover:text-foreground">Features</a></li>
              <li><a href="/#why" className="hover:text-foreground">Why TotalDash</a></li>
              <li><a href="/#pricing" className="hover:text-foreground">Pricing</a></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Company</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
              <li><Link to="/contact" className="hover:text-foreground">About</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Legal</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/contact" className="hover:text-foreground">Privacy</Link></li>
              <li><Link to="/contact" className="hover:text-foreground">Terms</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>© 2026 TotalDash. Hosted in the UK.</p>
          <a href="/agency/login" className="hover:text-foreground">Login</a>
        </div>
      </div>
    </footer>
  );
};
