import { ConversationsMock } from "@/components/marketing/mocks/ConversationsMock";
import { HandoverMock } from "@/components/marketing/mocks/HandoverMock";
import { TenantTreeMock } from "@/components/marketing/mocks/TenantTreeMock";
import { cn } from "@/lib/utils";

const FEATURES: Array<{
  title: string;
  body: string;
  side: "left" | "right";
  mock: React.ReactNode;
}> = [
  {
    title: "The conversations dashboard your clients live in.",
    body: "A real-time queue, transcripts, departments, search, and analytics — purpose-built for support teams running AI agents. No retraining required.",
    side: "right",
    mock: <ConversationsMock />,
  },
  {
    title: "Handover sessions, productised.",
    body: "Pending, active, resolved — every human takeover is a first-class object with timers, transfer history, and resolution criteria. The bit other tools paper over.",
    side: "left",
    mock: <HandoverMock />,
  },
  {
    title: "Multi-tenant by design.",
    body: "Agencies host clients. Clients invite users. Permissions resolve through four layers, isolated at the database. Add a customer in minutes, not a sprint.",
    side: "right",
    mock: <TenantTreeMock />,
  },
];

export const ProductSection = () => {
  return (
    <section id="product" className="border-b border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Everything your agency needs. Nothing your clients shouldn't see.
        </h2>

        <div className="mt-16 space-y-20">
          {FEATURES.map((f, idx) => (
            <div
              key={idx}
              className={cn(
                "grid items-center gap-10 lg:grid-cols-2 lg:gap-16",
              )}
            >
              <div className={cn(f.side === "left" ? "lg:order-2" : "lg:order-1")}>
                <h3 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {f.title}
                </h3>
                <p className="mt-4 text-base text-muted-foreground">{f.body}</p>
              </div>
              <div className={cn(f.side === "left" ? "lg:order-1" : "lg:order-2")}>
                {f.mock}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
