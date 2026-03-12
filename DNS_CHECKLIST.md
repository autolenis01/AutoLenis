# DNS Checklist for admin.autolenis.com

## Problem

`admin.autolenis.com` returns **NXDOMAIN** in the browser. This is a DNS-side issue — **code cannot fix this**. The domain must be configured at the DNS provider.

## Temporary Access (No Subdomain)

If the admin subdomain is not ready yet, keep admin access on the main domain:

- Leave `ADMIN_SUBDOMAIN_ENABLED` unset (or set to `false`) in the environment.
- Visit the admin dashboard at `https://autolenis.com/admin`.

Once DNS is configured, set `ADMIN_SUBDOMAIN_ENABLED=true` to redirect `/admin` to `admin.autolenis.com`.

## Required DNS Configuration

### For `admin.autolenis.com`

| Record Type | Name    | Value                    |
|-------------|---------|--------------------------|
| CNAME       | `admin` | `cname.vercel-dns.com.`  |

- **Preferred**: CNAME `admin` → `cname.vercel-dns.com`
- Ensure no conflicting A or CNAME records exist for the `admin` subdomain.
- If using **Cloudflare**: set the proxy status to **"DNS only"** (grey cloud) while validating, then enable proxy after verification if desired.

### Vercel Dashboard

1. Go to **Project Settings → Domains** in the Vercel dashboard.
2. Add `admin.autolenis.com` as a domain.
3. Vercel will provide the required DNS records — verify they match the CNAME above.
4. Wait for Vercel to confirm the domain is verified and SSL is provisioned.

## Verification Commands

```bash
# Check DNS resolution
nslookup admin.autolenis.com

# Detailed DNS query
dig admin.autolenis.com

# Check CNAME specifically
dig admin.autolenis.com CNAME

# Test HTTP response (after DNS propagates)
curl -I https://admin.autolenis.com
```

## Troubleshooting

- **NXDOMAIN**: The DNS record does not exist. Add the CNAME record above.
- **SERVFAIL**: DNS server issue. Wait and retry, or check DNS provider status.
- **SSL errors after DNS is set**: Wait for Vercel to provision the SSL certificate (can take up to 24 hours, usually minutes).
- **DNS propagation**: Changes can take up to 48 hours to propagate globally, though typically 5–30 minutes.

## Important Note

> NXDOMAIN is DNS-side; code cannot fix this. The middleware and routing logic in this repository are correct — the domain simply needs to be pointed to Vercel's servers via DNS.
