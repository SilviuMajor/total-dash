// Hosts where the marketing site (/, /contact, /signup) renders.
// On any other host (notably app.total-dash.com) the marketing routes are
// not registered and those paths fall through to the existing dashboard
// auth-redirect behaviour.
const MARKETING_HOSTS = new Set(["total-dash.com", "www.total-dash.com"]);

export const isMarketingHost = (): boolean => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (MARKETING_HOSTS.has(host)) return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".vercel.app")) return true;
  return false;
};
