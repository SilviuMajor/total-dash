import { Radio, Sparkles, Lock, Zap, FileText, Globe } from "lucide-react";
import { PermissionsMock } from "@/components/marketing/mocks/PermissionsMock";
import { AnalyticsMock } from "@/components/marketing/mocks/AnalyticsMock";

const FEATURES = [
  {
    Icon: Radio,
    title: "Realtime, not refresh",
    body: "Conversations, transcripts, and handover sessions stream into the dashboard via Supabase Realtime. The team sees every move as it happens — no polling, no spinners.",
  },
  {
    Icon: Sparkles,
    title: "AI Enhance, in the composer",
    body: "Rewrite outbound messages mid-handover. Improve, shorten, or warm up a draft with one click — Claude in the loop, your team in control.",
  },
  {
    Icon: FileText,
    title: "Transcripts you'd actually read",
    body: "Threaded view with attachments, captured Voiceflow variables, tags and notes. Custom canned responses per agent, plus full-text search across history.",
  },
  {
    Icon: Zap,
    title: "Knowledge base that ships",
    body: "Upload PDFs, DOCX, TXT, or URLs and the agent's KB updates immediately. Voiceflow KB is wired through end-to-end — no glue code.",
  },
  {
    Icon: Globe,
    title: "Custom domain, custom email",
    body: "Verified custom domain via the Vercel API, branded login pages, and your own sender. Clients land on dashboard.youragency.com and never see ours.",
  },
  {
    Icon: Lock,
    title: "Tenant isolation in the database",
    body: "Row-level security on every table, per-agency keys, audit log on administrative actions. The kind of boring that lets you sell to enterprise.",
  },
];

export const ProductSection = () => {
  return (
    <section id="product" className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            The platform
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Everything your agency needs. Nothing your clients shouldn't see.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Built end-to-end for agencies running AI conversations at scale. No bolt-ons, no half-features.
          </p>
        </div>

        {/* Bento: 6 features + 2 mock-cards */}
        <div className="mt-12 grid gap-4 lg:grid-cols-6">
          {/* Permissions mock spans 3 cols */}
          <div className="lg:col-span-3 lg:row-span-2">
            <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Permissions resolution
              </div>
              <h3 className="mt-1 text-xl font-semibold text-foreground">
                Four layers, lowest cap wins.
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Agency ceiling, client ceiling, role template, user override. Every change live-invalidates without a reload.
              </p>
              <div className="mt-5 flex-1">
                <PermissionsMock />
              </div>
            </div>
          </div>

          {/* Analytics mock spans 3 cols */}
          <div className="lg:col-span-3">
            <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Analytics
              </div>
              <h3 className="mt-1 text-xl font-semibold text-foreground">
                Numbers your client opens on a Monday.
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                KPI cards, handover funnel, per-agent breakdown, custom tabs. Export to CSV when finance asks.
              </p>
              <div className="mt-5">
                <AnalyticsMock />
              </div>
            </div>
          </div>

          {/* Six small feature cards */}
          {FEATURES.map(({ Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
              <Icon className="h-5 w-5 text-foreground" />
              <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
