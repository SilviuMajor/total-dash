import { Server, Shield, Lock, Users, FileText } from "lucide-react";

const ITEMS = [
  { Icon: Server, title: "UK-hosted", body: "Supabase London, eu-west-2." },
  { Icon: Shield, title: "GDPR-aligned", body: "Built around UK and EU data law." },
  { Icon: Lock, title: "Tenant-isolated", body: "Row-level security at the database." },
  { Icon: Users, title: "Role-based access", body: "Four-layer permission resolution." },
  { Icon: FileText, title: "Audit logged", body: "Every administrative action recorded." },
];

export const TrustSection = () => {
  return (
    <section className="border-b border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Built for B2B from the database up.
        </h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {ITEMS.map(({ Icon, title, body }) => (
            <div key={title} className="text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
