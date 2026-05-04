import { Globe, Check } from "lucide-react";

export const WhitelabelMock = () => {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">Custom domain</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-medium text-foreground">
          <Check className="h-3 w-3" />
          Verified
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-xs">
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-muted-foreground line-through">
          <span className="font-mono text-[11px]">app.total-dash.com</span>
          <span className="ml-auto text-[10px]">platform default</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-foreground/30 bg-foreground/[0.04] px-3 py-2.5">
          <span className="font-mono text-[11px] font-semibold text-foreground">dashboard.fiveleaf.co.uk</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--mk-status-with-ai))]" />
            Live
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-[11px]">
        <div className="rounded-md bg-muted/30 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Login page</div>
          <div className="mt-0.5 font-medium text-foreground">Your logo, your colours</div>
        </div>
        <div className="rounded-md bg-muted/30 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Email sender</div>
          <div className="mt-0.5 font-medium text-foreground">noreply@yours</div>
        </div>
        <div className="rounded-md bg-muted/30 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Widget loader</div>
          <div className="mt-0.5 font-medium text-foreground">Your CDN path</div>
        </div>
        <div className="rounded-md bg-muted/30 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Billing</div>
          <div className="mt-0.5 font-medium text-foreground">Your invoices</div>
        </div>
      </div>
    </div>
  );
};
