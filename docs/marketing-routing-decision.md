# Marketing site routing decision

## Background

The dashboard lives at `app.total-dash.com`. The apex `total-dash.com` had no
public-facing site. We wanted a marketing homepage at the apex without breaking
existing client login routes.

The original spec assumed a bare `/:agencySlug` route existed at the root (e.g.
`total-dash.com/heyb` → HeyB client login). It doesn't anymore — per
`CLAUDE.md`, that route was removed because it collided with app paths. Slug-
based client login lives at `/login/:agencySlug` only. So the original
"routing collision" framing is partly moot.

## Options considered

### Option A — Subdomain split

- `total-dash.com` → marketing (separate Vercel project, or hostname-aware
  bootstrap inside the same React app).
- `app.total-dash.com` → existing dashboard.
- **Pros:** cleanest separation; marketing and product are different mental
  models, different bundles, different telemetry.
- **Cons:** DNS / Vercel config work; if any existing emails, widget-loader
  output, or customer documentation already point at the apex, those would
  need an update. Needs a smarter custom-domain bootstrap to avoid the apex
  trying to serve the dashboard's `/` redirect logic.

### Option B — `/c/:slug` prefix

- `total-dash.com/` → marketing.
- `total-dash.com/c/heyb` → HeyB client login.
- **Pros:** single domain, no DNS.
- **Cons:** unnecessary in this codebase. The bare `/:agencySlug` route
  was already removed; client logins are at `/login/:agencySlug`. There is
  no slug-at-root path that needs moving. Including this option for parity
  with the spec only.

### Option C — Reserved root paths (chosen)

- `total-dash.com/` → marketing homepage.
- `total-dash.com/contact` → contact form.
- `total-dash.com/signup` → trial-signup placeholder.
- `total-dash.com/login/:agencySlug` → unchanged slug-based client login.
- **Pros:** lowest-risk; no DNS changes; single Vercel deploy; reuses the
  existing Tailwind / shadcn / CSS-variable design system directly. Reserved-
  slugs list (`src/pages/agency/AgencySettings.tsx`) already blocks
  conflicting names; we extended it with `contact` and `about`.
- **Cons:** the same React bundle is served on both apex and `app.`. We
  mitigate this with a host gate (see below) so dashboard users don't see
  marketing routes, and the marketing pages are lazy-loaded to keep them
  out of the dashboard bundle.

## Recommendation

**Option C** — reserved root paths with a hostname gate.

The marketing routes only register when the browser is on the apex
`total-dash.com` (or a dev host: `localhost`, `127.0.0.1`, `*.vercel.app`).
On `app.total-dash.com`, the routes do not exist and `/`, `/contact`,
`/signup` fall through to the existing dashboard auth-redirect behaviour
exactly as before. Implementation lives in
[`src/lib/marketing-host.ts`](../src/lib/marketing-host.ts) and is wired
into [`src/App.tsx`](../src/App.tsx).

Authed visitors hitting `total-dash.com/` are redirected to their natural
landing page (super admin → `/admin/agencies`, agency → `/agency/clients`,
client → `/conversations`) rather than seeing the marketing site, because
auth state is origin-scoped (apex and app. do not share storage in
production), this is mainly a developer-experience nicety on `localhost`.

The "Login" CTAs on the marketing site link to `/agency/login`. There is no
generic `/login` route in this codebase — agency operators are the most
likely audience clicking "Login" from a marketing page. Client users have
a slug-based URL their agency provides.

## Follow-ups not done in this change

- A combined `/login` page that auto-routes to the correct sub-login based
  on email domain or last-used agency slug.
- DB-side reservation for slug names (currently frontend-only).
- SEO basics — sitemap, OG tags, robots.txt — for the marketing pages.

## Files touched in this change

- Added `src/lib/marketing-host.ts`
- Added `src/pages/marketing/{HomePage,ContactPage,ComingSoonPage}.tsx`
- Added `src/components/marketing/MarketingNav.tsx`
- Added `src/components/marketing/MarketingFooter.tsx`
- Added `src/components/marketing/sections/*.tsx` (8 files)
- Added `src/components/marketing/mocks/*.tsx` (3 files)
- Added `supabase/functions/contact-form-submit/index.ts`
- Added `supabase/migrations/20260504000000_contact_submissions.sql`
- Modified `src/App.tsx` (host-gated marketing routes)
- Modified `src/pages/agency/AgencySettings.tsx` (extended `RESERVED_SLUGS`)
