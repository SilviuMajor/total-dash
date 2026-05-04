import { Link } from "react-router-dom";
import { TotalDashLogo } from "@/components/marketing/TotalDashLogo";

export const MarketingFooter = () => {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <TotalDashLogo variant="full" className="h-6 w-auto" />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              The customer-service platform AI agencies build their business on.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><a href="/#product" className="hover:text-foreground">Features</a></li>
              <li><a href="/#workflow" className="hover:text-foreground">Workflow</a></li>
              <li><a href="/#whitelabel" className="hover:text-foreground">White-label</a></li>
              <li><a href="/#pricing" className="hover:text-foreground">Pricing</a></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Company</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
              <li><Link to="/contact" className="hover:text-foreground">About</Link></li>
              <li><a href="/agency/login" className="hover:text-foreground">Login</a></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Legal</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/contact" className="hover:text-foreground">Privacy</Link></li>
              <li><Link to="/contact" className="hover:text-foreground">Terms</Link></li>
              <li><Link to="/contact" className="hover:text-foreground">Data processing</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>© 2026 Total Dash. Hosted in the UK.</p>
          <p className="font-mono text-xs">eu-west-2 · GDPR-aligned · Tenant-isolated</p>
        </div>
      </div>
    </footer>
  );
};
