import { cn } from "@/lib/utils";

type NodeProps = {
  label: string;
  sub?: string;
  variant?: "primary" | "default" | "muted";
  className?: string;
};

const Node = ({ label, sub, variant = "default", className }: NodeProps) => (
  <div
    className={cn(
      "rounded-md border px-3 py-1.5 text-center shadow-sm",
      variant === "primary" && "border-primary bg-primary/10",
      variant === "default" && "border-border bg-card",
      variant === "muted" && "border-dashed border-muted-foreground/40 bg-muted/40",
      className
    )}
  >
    <div className={cn("text-xs font-semibold", variant === "primary" ? "text-primary" : "text-foreground")}>
      {label}
    </div>
    {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
  </div>
);

export const TenantTreeMock = () => {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-lg">
      <svg viewBox="0 0 480 320" className="h-auto w-full" role="img" aria-label="Multi-tenant hierarchy">
        <defs>
          <style>{`.line { stroke: hsl(var(--border)); stroke-width: 1.5; fill: none; }`}</style>
        </defs>

        {/* Connectors: super → agencies */}
        <path className="line" d="M 240 50 V 80 H 130 V 110" />
        <path className="line" d="M 240 50 V 80 H 350 V 110" />
        {/* Connectors: agency → clients */}
        <path className="line" d="M 130 150 V 175 H 70 V 200" />
        <path className="line" d="M 130 150 V 175 H 190 V 200" />
        <path className="line" d="M 350 150 V 175 H 290 V 200" />
        <path className="line" d="M 350 150 V 175 H 410 V 200" />
        {/* Connectors: client → users (one client only, illustrative) */}
        <path className="line" d="M 70 240 V 265 H 30 V 285" />
        <path className="line" d="M 70 240 V 265 H 70 V 285" />
        <path className="line" d="M 70 240 V 265 H 110 V 285" />

        <foreignObject x="180" y="20" width="120" height="32">
          <Node label="Super Admin" variant="primary" />
        </foreignObject>

        <foreignObject x="80" y="110" width="100" height="40">
          <Node label="Fiveleaf" sub="Agency" />
        </foreignObject>
        <foreignObject x="300" y="110" width="100" height="40">
          <Node label="Acme AI" sub="Agency" />
        </foreignObject>

        <foreignObject x="20" y="200" width="100" height="40">
          <Node label="HeyB" sub="Client" />
        </foreignObject>
        <foreignObject x="140" y="200" width="100" height="40">
          <Node label="NorthCo" sub="Client" />
        </foreignObject>
        <foreignObject x="240" y="200" width="100" height="40">
          <Node label="Atlas" sub="Client" />
        </foreignObject>
        <foreignObject x="360" y="200" width="100" height="40">
          <Node label="Brio" sub="Client" />
        </foreignObject>

        <foreignObject x="0" y="285" width="60" height="28">
          <Node label="user" variant="muted" />
        </foreignObject>
        <foreignObject x="40" y="285" width="60" height="28">
          <Node label="user" variant="muted" />
        </foreignObject>
        <foreignObject x="80" y="285" width="60" height="28">
          <Node label="…" variant="muted" />
        </foreignObject>
      </svg>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Super admin · Agencies · Clients · Users — isolated at the database
      </p>
    </div>
  );
};
