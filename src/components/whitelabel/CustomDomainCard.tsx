// CustomDomainCard
//
// Self-contained 4-state machine that walks an agency through setting up
// (or removing) a custom whitelabel domain like dashboard.fiveleaf.co.uk.
// All Vercel API plumbing happens in the whitelabel-domain-actions Edge
// Function; this component is purely the UX wrapper around its responses.

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";

interface AgencyForCard {
  id: string;
  whitelabel_subdomain: string | null;
  whitelabel_domain: string | null;
  whitelabel_verified: boolean | null;
  whitelabel_verified_at: string | null;
}

interface CustomDomainCardProps {
  agency: AgencyForCard;
  onUpdate: () => void; // Called after register/verify/remove so parent refetches the agency row
}

interface VercelVerification {
  type: string;
  domain: string;
  value: string;
  reason: string;
}

interface VercelDomain {
  name: string;
  verified: boolean;
  verification?: VercelVerification[];
}

// Multi-signal status returned by the Edge Function. Vercel's `verified`
// only confirms ownership challenges; the URL only actually serves
// traffic when all three are true.
interface DomainStatus {
  vercelVerified: boolean;
  dnsRouted: boolean;
  httpReady: boolean;
  fullyLive: boolean;
}

type CardState = 'not_configured' | 'awaiting_dns' | 'live' | 'error';

// Sub-state of `awaiting_dns`, derived from DomainStatus so the UI shows
// exactly which step the agency is on.
type SubState = 'all_pending' | 'need_routing' | 'need_ownership' | 'provisioning_ssl';

function deriveSubState(s: DomainStatus | null): SubState {
  if (!s) return 'all_pending';
  if (s.vercelVerified && s.dnsRouted && !s.httpReady) return 'provisioning_ssl';
  if (s.vercelVerified && !s.dnsRouted) return 'need_routing';
  if (!s.vercelVerified && s.dnsRouted) return 'need_ownership';
  return 'all_pending';
}

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const POLL_INTERVAL_MS = 5_000;
const POLL_CAP_COUNT = 60; // 5 minutes at 5s intervals

// In-app guidance for the most-used DNS providers. Steps are deliberately
// short — agencies should be able to scan and act, not read a manual.
// `nameHint` describes what the provider calls the Name/Host field and
// what form it expects (relative subdomain vs full FQDN).
interface ProviderGuide {
  name: string;
  steps: string[];
  nameHint: string;
  href: string;
  warning?: string;
}

const PROVIDER_GUIDES: ProviderGuide[] = [
  {
    name: 'Cloudflare',
    steps: [
      'Cloudflare dashboard → your domain → DNS → Records → Add record.',
      'Add the records exactly as shown above.',
    ],
    nameHint: '"Name" field accepts either the relative subdomain or the full FQDN.',
    warning: 'Set Proxy status to "DNS only" (grey cloud) for the routing CNAME, otherwise SSL provisioning fails.',
    href: 'https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/#create-a-cname-record',
  },
  {
    name: 'Squarespace Domains',
    steps: [
      'domains.squarespace.com → your domain → DNS.',
      'Scroll to Custom Records → Add Record.',
    ],
    nameHint: '"Host" field wants just the subdomain (e.g. dashboard).',
    href: 'https://support.squarespace.com/hc/en-us/articles/205812348',
  },
  {
    name: 'GoDaddy',
    steps: [
      'Domain Portfolio → your domain → DNS → Add Record.',
      'Add the records exactly as shown.',
    ],
    nameHint: '"Host" field wants just the subdomain (or @ for the apex).',
    href: 'https://www.godaddy.com/help/add-a-cname-record-19236',
  },
  {
    name: 'Namecheap',
    steps: [
      'Domain List → Manage → Advanced DNS → Add New Record.',
      'Add the records exactly as shown.',
    ],
    nameHint: '"Host" field wants just the subdomain.',
    href: 'https://www.namecheap.com/support/knowledgebase/article.aspx/9646/2237/how-to-create-a-cname-record-for-your-domain/',
  },
  {
    name: 'Google Cloud DNS',
    steps: [
      'console.cloud.google.com → Network services → Cloud DNS.',
      'Open your zone → Add Record Set.',
    ],
    nameHint: 'DNS Name field auto-completes the apex; type just the subdomain prefix.',
    href: 'https://cloud.google.com/dns/docs/records',
  },
  {
    name: 'AWS Route 53',
    steps: [
      'Route 53 → Hosted zones → your zone → Create record.',
      'Use Simple routing → enter the subdomain in Record name.',
    ],
    nameHint: 'Record name field shows the subdomain prefix; full FQDN is built from it. Drop any trailing dot.',
    href: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html',
  },
];

export function CustomDomainCard({ agency, onUpdate }: CustomDomainCardProps) {
  const { toast } = useToast();

  const initialState: CardState = agency.whitelabel_verified
    ? 'live'
    : agency.whitelabel_domain
      ? 'awaiting_dns'
      : 'not_configured';

  const [state, setState] = useState<CardState>(initialState);
  const [subdomainInput, setSubdomainInput] = useState(agency.whitelabel_subdomain || 'dashboard');
  const [domainInput, setDomainInput] = useState(agency.whitelabel_domain || '');
  const [submitting, setSubmitting] = useState(false);
  const [verification, setVerification] = useState<VercelVerification[]>([]);
  const [lastStatus, setLastStatus] = useState<DomainStatus | null>(null);
  const [pollSeconds, setPollSeconds] = useState(0);
  const [pollCapped, setPollCapped] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showChangeConfirm, setShowChangeConfirm] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [providerHelpOpen, setProviderHelpOpen] = useState(false);
  const [openProvider, setOpenProvider] = useState<string | null>(null);
  const [recheckingNow, setRecheckingNow] = useState(false);

  const pollTimerRef = useRef<number | null>(null);
  const pollTickRef = useRef<number | null>(null);
  const pollCountRef = useRef(0);

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (pollTickRef.current !== null) {
      window.clearInterval(pollTickRef.current);
      pollTickRef.current = null;
    }
  };

  // Effect for awaiting_dns: re-fetch verification + status, start polling.
  useEffect(() => {
    if (state !== 'awaiting_dns') {
      stopPolling();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('whitelabel-domain-actions', {
          body: { action: 'status', agencyId: agency.id },
        });
        if (cancelled) return;
        if (error) throw new Error(error.message);
        if (data?.success === false) throw new Error(data.error || 'Couldn\'t fetch domain status');
        const dom = data?.domain as VercelDomain | undefined;
        const status = data?.status as DomainStatus | undefined;
        if (status) setLastStatus(status);
        if (dom) {
          setVerification(dom.verification || []);
          if (status?.fullyLive) {
            handleVerifiedFlip();
            return;
          }
        }
        startPolling();
      } catch (err) {
        if (cancelled) return;
        // status fetch failed — let the user manually retry
        setPollCapped(true);
      }
    })();
    return () => {
      cancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, agency.id]);

  // Self-healing on mount in `live` state: validate that the URL still
  // actually works. If routing or SSL has drifted (or the DB was set to
  // verified=true under the old single-signal logic), drop back to
  // awaiting_dns with the missing record(s) in focus.
  useEffect(() => {
    if (state !== 'live') return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('whitelabel-domain-actions', {
          body: { action: 'status', agencyId: agency.id },
        });
        if (cancelled || error || data?.success === false) return;
        const dom = data?.domain as VercelDomain | undefined;
        const status = data?.status as DomainStatus | undefined;
        if (status) setLastStatus(status);
        if (status && !status.fullyLive) {
          setVerification(dom?.verification || []);
          setState('awaiting_dns');
          // onUpdate so the agency row's whitelabel_verified is refreshed
          // from the Edge Function's revert-on-drift write.
          onUpdate();
        }
      } catch {
        // network blip — leave state alone, next render or recheck will retry
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, agency.id]);

  const startPolling = () => {
    stopPolling();
    pollCountRef.current = 0;
    setPollSeconds(0);
    setPollCapped(false);

    // Tick every second to update the elapsed counter
    pollTickRef.current = window.setInterval(() => {
      setPollSeconds((s) => s + 1);
    }, 1000);

    // Verify every POLL_INTERVAL_MS
    pollTimerRef.current = window.setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current >= POLL_CAP_COUNT) {
        stopPolling();
        setPollCapped(true);
        return;
      }
      await runVerifyOnce();
    }, POLL_INTERVAL_MS);
  };

  const runVerifyOnce = async (): Promise<void> => {
    try {
      const { data, error } = await supabase.functions.invoke('whitelabel-domain-actions', {
        body: { action: 'verify', agencyId: agency.id },
      });
      if (error) return; // transient — keep polling
      if (data?.success === false) return; // ditto
      const dom = data?.domain as VercelDomain | undefined;
      const status = data?.status as DomainStatus | undefined;
      if (status) setLastStatus(status);
      if (dom?.verification) {
        // Vercel sometimes refines the challenge; keep ours fresh
        setVerification(dom.verification);
      }
      if (status?.fullyLive) {
        handleVerifiedFlip();
      }
    } catch {
      // network blip — let the next tick try again
    }
  };

  const handleManualCheck = async () => {
    setSubmitting(true);
    setPollCapped(false);
    pollCountRef.current = 0;
    setPollSeconds(0);
    await runVerifyOnce();
    setSubmitting(false);
    if (state === 'awaiting_dns') {
      startPolling();
    }
  };

  // "Recheck now" — fires an immediate verify regardless of poll cadence.
  // Available in awaiting_dns AND live states (the latter to manually
  // trigger drift detection).
  const handleRecheckNow = async () => {
    setRecheckingNow(true);
    await runVerifyOnce();
    setRecheckingNow(false);
  };

  const handleVerifiedFlip = () => {
    stopPolling();
    setState('live');
    setVerification([]);
    onUpdate();
    toast({
      title: 'Custom domain live',
      description: `${buildFqdn(agency.whitelabel_subdomain || 'dashboard', agency.whitelabel_domain || '')} is now serving your branded login.`,
    });
  };

  const handleRegister = async () => {
    setErrorMessage('');
    if (!SUBDOMAIN_RE.test(subdomainInput.trim())) {
      setErrorMessage('Use letters, digits, and hyphens for the subdomain.');
      return;
    }
    if (!DOMAIN_RE.test(domainInput.trim())) {
      setErrorMessage('That doesn\'t look like a valid domain. Should be e.g. yourcompany.com.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('whitelabel-domain-actions', {
        body: {
          action: 'register',
          agencyId: agency.id,
          subdomain: subdomainInput.trim().toLowerCase(),
          domain: domainInput.trim().toLowerCase(),
        },
      });
      if (error) throw new Error(error.message);
      if (data?.success === false) throw new Error(humaniseError(data.error || 'Couldn\'t add domain'));

      const dom = data?.domain as VercelDomain | undefined;
      const status = data?.status as DomainStatus | undefined;
      if (!dom) throw new Error('Vercel returned an unexpected response');

      onUpdate();

      if (status) setLastStatus(status);
      setVerification(dom.verification || []);
      if (status?.fullyLive) {
        handleVerifiedFlip();
      } else {
        setState('awaiting_dns');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Couldn\'t add domain';
      setErrorMessage(msg);
      setState('error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    setShowRemoveConfirm(false);
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('whitelabel-domain-actions', {
        body: { action: 'remove', agencyId: agency.id },
      });
      if (error) throw new Error(error.message);
      if (data?.success === false) throw new Error(data.error || 'Couldn\'t remove domain');

      stopPolling();
      setState('not_configured');
      setVerification([]);
      setSubdomainInput('dashboard');
      setDomainInput('');
      setErrorMessage('');
      onUpdate();
      toast({
        title: 'Custom domain removed',
        description: 'Your clients will sign in at app.total-dash.com again.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Couldn\'t remove domain';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = () => {
    setShowChangeConfirm(false);
    // Same as remove + back to not_configured, then user can enter new values
    handleRemove();
  };

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast({ title: 'Couldn\'t copy', variant: 'destructive' });
    }
  };

  // ---------- RENDER ----------

  if (state === 'live') {
    const fqdn = buildFqdn(agency.whitelabel_subdomain || 'dashboard', agency.whitelabel_domain || '');
    const liveSince = agency.whitelabel_verified_at
      ? format(new Date(agency.whitelabel_verified_at), 'do MMMM yyyy')
      : null;
    const url = `https://${fqdn}`;
    return (
      <Card className="p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Custom domain · <span className="font-mono">{fqdn}</span></h3>
          <p className="text-sm text-sage-fg flex items-center gap-1.5">
            <Check className="h-4 w-4" /> Live{liveSince ? ` since ${liveSince}` : ''}
          </p>
        </div>

        <div className="rounded-md border bg-muted/30 p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Your clients log in at</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono truncate">{url}</code>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => handleCopy('url', url)}
            >
              {copiedKey === 'url' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              asChild
            >
              <a href={url} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowChangeConfirm(true)}>
            Change domain
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setShowRemoveConfirm(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Remove custom domain
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRecheckNow}
            disabled={recheckingNow}
            className="text-xs ml-auto"
            title="Re-validates DNS routing and SSL — useful if the URL stops working"
          >
            {recheckingNow
              ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Recheck
          </Button>
        </div>

        {confirmDialogs()}
      </Card>
    );
  }

  if (state === 'awaiting_dns') {
    const subdomain = agency.whitelabel_subdomain || 'dashboard';
    const apex = agency.whitelabel_domain || '';
    const fqdn = buildFqdn(subdomain, apex);
    const records = buildDisplayRecords(subdomain, apex, verification);
    const subState = deriveSubState(lastStatus);

    // Phase-aware header message + record-row "satisfied" flags. We keep
    // every record visible (greyed when satisfied) so agencies can confirm
    // what's already in place vs what's still missing.
    const phaseHeader = (() => {
      switch (subState) {
        case 'need_routing':
          return {
            icon: <Loader2 className="h-4 w-4 animate-spin" />,
            text: 'Ownership verified ✓ — now add the routing CNAME below.',
            tone: 'amber' as const,
          };
        case 'need_ownership':
          return {
            icon: <Loader2 className="h-4 w-4 animate-spin" />,
            text: 'Routing detected ✓ — add the ownership TXT below to finish.',
            tone: 'amber' as const,
          };
        case 'provisioning_ssl':
          return {
            icon: <Loader2 className="h-4 w-4 animate-spin" />,
            text: 'Everything in place ✓ — provisioning SSL certificate (~30 seconds)…',
            tone: 'sky' as const,
          };
        default:
          return {
            icon: <Loader2 className="h-4 w-4 animate-spin" />,
            text: 'Add the records below at your DNS provider.',
            tone: 'amber' as const,
          };
      }
    })();
    const headerToneClass = phaseHeader.tone === 'sky'
      ? 'text-sky-fg'
      : 'text-peach-fg';

    const isRecordSatisfied = (label: string | undefined): boolean => {
      if (!lastStatus) return false;
      if (label === 'Routing — sends traffic to Vercel') return lastStatus.dnsRouted;
      if (label === 'Ownership verification') return lastStatus.vercelVerified;
      return false;
    };

    return (
      <Card className="p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Custom domain · <span className="font-mono">{fqdn}</span></h3>
          <p className={`text-sm flex items-center gap-1.5 ${headerToneClass}`}>
            {phaseHeader.icon} {phaseHeader.text}
          </p>
        </div>

        {subState !== 'provisioning_ssl' && (
          <>
            <div className="space-y-2">
              <p className="text-sm">
                Add {records.length === 1 ? 'this record' : `these ${records.length} records`} at your DNS provider for{' '}
                <span className="font-mono">{apex}</span>:
              </p>
              <div className="rounded-md border overflow-hidden divide-y">
                {records.map((r, idx) => {
                  const satisfied = isRecordSatisfied(r.label);
                  return (
                    <div
                      key={idx}
                      className={`p-3 space-y-2 ${satisfied ? 'bg-muted/40 opacity-60' : ''}`}
                    >
                      {r.label && (
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1.5">
                          {satisfied && <Check className="h-3 w-3 text-sage-fg" />}
                          {r.label}
                          {satisfied && <span className="text-sage-fg normal-case tracking-normal">in place</span>}
                        </p>
                      )}
                      <div className="grid grid-cols-[80px_1fr_auto] items-center gap-2 text-xs">
                        <span className="text-muted-foreground uppercase">Type</span>
                        <code className="font-mono">{r.type}</code>
                        <span aria-hidden="true" />

                        <span className="text-muted-foreground">Name</span>
                        <code className="font-mono break-all">{r.name}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => handleCopy(`name-${idx}`, r.name)}
                          disabled={satisfied}
                        >
                          {copiedKey === `name-${idx}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>

                        <span className="text-muted-foreground">Value</span>
                        <code className="font-mono break-all">{r.value}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => handleCopy(`value-${idx}`, r.value)}
                          disabled={satisfied}
                        >
                          {copiedKey === `value-${idx}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Most providers (Squarespace, GoDaddy, Namecheap, etc.) expect just the subdomain in the Name/Host field.
                If your provider asks for the full domain, paste{' '}
                <span className="font-mono">{fqdn}</span> instead. SSL is provisioned by Vercel directly — if your provider
                has a "proxy" or "CDN" option for the routing CNAME, turn it off (DNS-only).
              </p>
            </div>

            {renderProviderHelp(subdomain, apex)}
            {renderCommonMistakes()}
          </>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {pollCapped
              ? 'Auto-checking paused. Click below to check now.'
              : `Auto-checking every 5 seconds — ${formatElapsed(pollSeconds)} elapsed`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRecheckNow}
              disabled={recheckingNow}
              className="h-7 text-xs"
            >
              {recheckingNow
                ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Recheck now
            </Button>
            {pollCapped && (
              <Button size="sm" variant="outline" onClick={handleManualCheck} disabled={submitting}>
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                I've added the records
              </Button>
            )}
          </div>
        </div>

        <div className="pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setShowRemoveConfirm(true)}
            disabled={submitting}
          >
            Cancel and remove
          </Button>
        </div>

        {confirmDialogs()}
      </Card>
    );
  }

  // not_configured (initial setup form). Also reused for "error" state with
  // an error banner above the inputs.
  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Custom domain</h3>
        <p className="text-xs text-muted-foreground">
          Use your own URL instead of <span className="font-mono">app.total-dash.com</span>.
        </p>
      </div>

      {state === 'error' && errorMessage && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="wld-subdomain" className="text-xs">Subdomain</Label>
          <Input
            id="wld-subdomain"
            value={subdomainInput}
            onChange={(e) => setSubdomainInput(e.target.value.toLowerCase())}
            placeholder="dashboard"
            disabled={submitting}
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="wld-domain" className="text-xs">Domain</Label>
          <Input
            id="wld-domain"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value.toLowerCase())}
            placeholder="yourcompany.com"
            disabled={submitting}
            className="font-mono text-sm"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        →{' '}
        <span className="font-mono">
          {(subdomainInput || 'dashboard').trim()}.{(domainInput || 'yourcompany.com').trim()}
        </span>
      </p>

      <Button onClick={handleRegister} disabled={submitting || !domainInput.trim()}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Set up custom domain
      </Button>
    </Card>
  );

  function renderProviderHelp(subdomain: string, apex: string) {
    return (
      <div className="rounded-md border border-dashed">
        <button
          type="button"
          onClick={() => setProviderHelpOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-1.5">
            {providerHelpOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Need help adding records at your DNS provider?
          </span>
        </button>
        {providerHelpOpen && (
          <div className="border-t divide-y">
            {PROVIDER_GUIDES.map((g) => {
              const isOpen = openProvider === g.name;
              return (
                <div key={g.name} className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setOpenProvider(isOpen ? null : g.name)}
                    className="w-full flex items-center justify-between text-xs text-foreground"
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {g.name}
                    </span>
                    <a
                      href={g.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      docs <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </button>
                  {isOpen && (
                    <div className="mt-2 space-y-1.5 text-xs text-muted-foreground pl-4">
                      <ol className="space-y-1 list-decimal list-inside">
                        {g.steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                      <p className="text-[11px]"><span className="font-medium text-foreground">Field name:</span> {g.nameHint}</p>
                      {g.warning && (
                        <p className="text-[11px] text-peach-fg">
                          <span className="font-medium">Important:</span> {g.warning}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="px-3 py-2 text-[11px] text-muted-foreground">
              Other provider? Look for "DNS", "Custom Records", or "Records" in their dashboard. The fields and values are the same everywhere.
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderCommonMistakes() {
    return (
      <div className="rounded-md border border-peach-bg-2/60 bg-peach-bg/60 p-3 space-y-1.5">
        <p className="text-[11px] uppercase tracking-wide font-medium text-peach-fg">
          Common mistakes
        </p>
        <ul className="text-xs text-peach-fg space-y-1 list-disc pl-4">
          <li>
            <span className="font-medium">Pasted the full domain in the Name field.</span>{' '}
            "Name" usually wants just the prefix — <span className="font-mono">{agency.whitelabel_subdomain || 'dashboard'}</span>,
            not the full FQDN.
          </li>
          <li>
            <span className="font-medium">Cloudflare proxy enabled.</span>{' '}
            Orange-cloud blocks Vercel from issuing the SSL cert. Switch to grey-cloud (DNS only) for the routing CNAME.
          </li>
          <li>
            <span className="font-medium">Forgot the routing CNAME.</span>{' '}
            Some setups need both a TXT (ownership) and a CNAME (routing). The URL won't serve until both are in DNS.
          </li>
        </ul>
      </div>
    );
  }

  function confirmDialogs() {
    return (
      <>
        <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove custom domain?</AlertDialogTitle>
              <AlertDialogDescription>
                Your clients will sign in at <span className="font-mono">app.total-dash.com/login/{'<your-slug>'}</span> again.
                The DNS record at your provider can stay or be deleted — your call.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemove}
                disabled={submitting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showChangeConfirm} onOpenChange={setShowChangeConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Change custom domain?</AlertDialogTitle>
              <AlertDialogDescription>
                This will take down your current branded URL until DNS is set up for the new one.
                You'll start the setup flow from scratch.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleChange}
                disabled={submitting}
              >
                Change
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }
}

function buildFqdn(subdomain: string, domain: string): string {
  if (!domain) return subdomain;
  return `${subdomain}.${domain}`;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Map raw Vercel error codes / strings to friendlier messages. Falls through
// to the original string if no mapping applies.
function humaniseError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('already')) return 'This domain is already in use on Vercel. Contact support if you believe this is yours.';
  if (lower.includes('invalid')) return 'That doesn\'t look like a valid domain. Check the spelling.';
  if (lower.includes('payment')) return 'Couldn\'t set up the domain (payment issue on the platform). Contact support.';
  if (lower.includes('forbidden')) return 'You don\'t have permission to manage domains for this agency.';
  return raw;
}

interface DisplayRecord {
  type: string;
  name: string;
  value: string;
  label?: string;
}

// Composes the DNS records the agency actually needs to add at their
// provider. Vercel's verification[] only contains *ownership* challenges
// (TXT for apex-owned-elsewhere domains, sometimes a CNAME). It does NOT
// include the routing record that's required for traffic to reach Vercel
// for the subdomain itself — which is always a CNAME to cname.vercel-dns.com.
//
// We:
//   1. Always include the routing CNAME (subdomain → cname.vercel-dns.com).
//   2. Add Vercel's verification challenges, with the apex stripped from
//      the Name field so DNS providers like Cloudflare/GoDaddy see the
//      relative form they expect (e.g. _vercel instead of _vercel.fiveleaf.co.uk).
//   3. De-duplicate when Vercel's challenge IS the routing CNAME.
function buildDisplayRecords(
  subdomain: string,
  apex: string,
  verification: VercelVerification[],
): DisplayRecord[] {
  const records: DisplayRecord[] = [];

  // Routing — always required for traffic
  records.push({
    type: 'CNAME',
    name: subdomain,
    value: 'cname.vercel-dns.com',
    label: 'Routing — sends traffic to Vercel',
  });

  for (const v of verification) {
    const name = stripApex(v.domain, apex);
    const isDuplicate = records.some((r) =>
      r.type.toUpperCase() === v.type.toUpperCase() &&
      r.name.toLowerCase() === name.toLowerCase() &&
      r.value === v.value,
    );
    if (isDuplicate) continue;

    records.push({
      type: v.type.toUpperCase(),
      name,
      value: v.value,
      label: 'Ownership verification',
    });
  }

  return records;
}

// _vercel.fiveleaf.co.uk + apex=fiveleaf.co.uk  →  _vercel
// testdashboard.fiveleaf.co.uk + apex=fiveleaf.co.uk  →  testdashboard
// fiveleaf.co.uk + apex=fiveleaf.co.uk  →  @  (apex marker; rare for our flow)
function stripApex(name: string, apex: string): string {
  if (!apex) return name;
  const lowerName = name.toLowerCase();
  const lowerApex = apex.toLowerCase();
  if (lowerName === lowerApex) return '@';
  if (lowerName.endsWith(`.${lowerApex}`)) {
    return name.slice(0, -(apex.length + 1));
  }
  return name;
}
