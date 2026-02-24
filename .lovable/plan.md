

## Complete Cloudflare Custom Domain Implementation Plan

### Phase 1: Cloudflare Infrastructure Setup (One-time, you do this)

**1.1 Create Cloudflare Account & Worker**
- Sign up for free Cloudflare account at cloudflare.com
- Go to Workers & Pages → Create Worker
- Name it something like `totaldash-proxy`

**1.2 Worker Code** (I'll provide this):
```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const originalHost = url.hostname; // e.g., dashboard.fiveleaf.co.uk
    
    // Rewrite to your actual app
    url.hostname = 'total-dash.com';
    
    // Clone request with new URL and add original host header
    const modifiedRequest = new Request(url.toString(), {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
    });
    
    // Pass the original domain so your app knows which agency
    modifiedRequest.headers.set('X-Original-Host', originalHost);
    modifiedRequest.headers.set('X-Forwarded-Host', originalHost);
    
    // Fetch from your actual app
    const response = await fetch(modifiedRequest);
    
    // Return response with CORS headers if needed
    return response;
  }
}
```

**1.3 Configure Custom Domains for Worker**
- In Worker settings → Triggers → Custom Domains
- You'll get a `*.workers.dev` URL (e.g., `totaldash-proxy.yourname.workers.dev`)
- This is what agencies will CNAME to

---

### Phase 2: Update App to Detect Custom Domains

**2.1 Update `check-domain-context` edge function:**
- Check for `X-Original-Host` or `X-Forwarded-Host` headers
- If present, use that domain instead of the request host
- Look up agency by `whitelabel_domain` field

**2.2 Update `check-domain-context/index.ts`:**
```typescript
// At the start of the function:
const originalHost = req.headers.get('x-original-host') || 
                     req.headers.get('x-forwarded-host') || 
                     domain;

// Then use originalHost for agency lookup instead of domain
const { data: whitelabelAgency } = await supabase
  .from('agencies')
  .select('*')
  .eq('whitelabel_domain', originalHost.replace(/^dashboard\./, ''))
  .eq('whitelabel_verified', true)
  .single();
```

---

### Phase 3: Update Agency Settings UI

**3.1 Add "Custom Domain" title to the whitelabel section**

**3.2 Update DNS instructions to show:**
- The actual Cloudflare Worker URL to CNAME to
- Clear step-by-step instructions for agencies

**3.3 Update verification to actually check:**
- That the CNAME points to your Cloudflare Worker
- That the domain resolves correctly

**3.4 Example UI text:**
```
Custom Domain Setup

1. In your domain's DNS settings, add a CNAME record:
   
   Type: CNAME
   Name: dashboard (or your preferred subdomain)
   Target: totaldash-proxy.yourname.workers.dev

2. Wait 5-10 minutes for DNS propagation

3. Click "Verify Domain" below
```

---

### Phase 4: Database & Config Updates

**4.1 Ensure agencies table has:**
- `whitelabel_subdomain` - e.g., "dashboard"
- `whitelabel_domain` - e.g., "fiveleaf.co.uk"  
- `whitelabel_verified` - boolean
- `whitelabel_verified_at` - timestamp

**4.2 Update `verify-whitelabel-domain` function:**
- Check that CNAME points to your Cloudflare Worker URL
- Store the worker URL as an env variable/secret

---

### Phase 5: Client Login Flow

**5.1 Update login URL generation:**
- For verified whitelabel agencies: `https://dashboard.fiveleaf.co.uk/client/login`
- For non-whitelabel: `https://total-dash.com/login/fiveleaf`

**5.2 Update `SlugBasedAuth` and routing:**
- When accessed via custom domain, detect agency from domain
- Apply full whitelabel branding

---

### What Fiveleaf Would Do (Their Side)

1. Log into their domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)
2. Go to DNS settings for fiveleaf.co.uk
3. Add one record:
   - **Type:** CNAME
   - **Name:** dashboard
   - **Value:** totaldash-proxy.yourname.workers.dev
4. Wait 5-10 minutes
5. In your platform, click "Verify Domain"
6. Done! `dashboard.fiveleaf.co.uk` now works

---

### Cost & Limitations

| Item | Free Tier Limit |
|------|----------------|
| Cloudflare Workers | 100,000 requests/day |
| Custom domains | Unlimited |
| SSL certificates | Automatic & free |

For most agencies, 100k requests/day is plenty. If you exceed this, Cloudflare's paid tier is ~$5/month for 10M requests.

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/check-domain-context/index.ts` | Add X-Original-Host header detection |
| `supabase/functions/verify-whitelabel-domain/index.ts` | Update to verify CNAME points to Cloudflare Worker |
| `src/pages/agency/AgencySettings.tsx` | Add "Custom Domain" title, update instructions |
| New: Cloudflare Worker code | Provide ready-to-deploy code |

