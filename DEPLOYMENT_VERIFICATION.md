# Deployment Verification Guide

## Required Environment Variables

Set these in Vercel → Project Settings → Environment Variables:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | ✅ | Public URL (e.g., `https://your-app.vercel.app`) |
| `JWT_SECRET` | ✅ | Auth JWT secret. Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | Same as `NEXT_PUBLIC_APP_URL` |
| `NEXTAUTH_SECRET` | ✅ | NextAuth secret. Generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `POSTGRES_PRISMA_URL` | ✅ | PostgreSQL connection string |
| `STRIPE_SECRET_KEY` | ✅ | Stripe secret API key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Stripe webhook signing secret |
| `RESEND_API_KEY` | ⚡ | Email provider (Resend) |
| `CRON_SECRET` | ⚡ | Secret for cron job authentication |
| `ESIGN_WEBHOOK_SECRET` | ⚡ | E-sign webhook verification |
| `INTERNAL_API_KEY` | ⚡ | Internal API authentication |

✅ = Required for deployment  
⚡ = Required for specific features

## How to Deploy on Vercel

### 1. Connect Repository
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the GitHub repository
3. Vercel will auto-detect Next.js

### 2. Configure Build Settings
- **Framework Preset**: Next.js
- **Build Command**: `pnpm build` (auto-detected)
- **Install Command**: `pnpm install` (auto-detected)
- **Output Directory**: `.next` (default)

### 3. Set Environment Variables
Add all required environment variables from the table above.

### 4. Deploy
Click **Deploy**. The build process:
1. `pnpm install` — installs dependencies
2. `prisma generate` — generates Prisma client (via postinstall)
3. `next build` — builds the application

### 5. Verify Deployment
After deployment, verify these endpoints:

```bash
# Health check (root level — no auth)
curl -i https://your-app.vercel.app/health
# Expected: 200 OK, {"status":"healthy","timestamp":"..."}

# API health check (no auth)
curl -i https://your-app.vercel.app/api/health
# Expected: 200 OK, {"status":"healthy","database":"up",...}
```

## Health Check Endpoints

| Endpoint | Auth Required | Description |
|---|---|---|
| `GET /health` | ❌ No | Simple health check for load balancers |
| `GET /api/health` | ❌ No | Detailed health with database check |
| `GET /api/auth/health` | ❌ No | Auth system health check |
| `GET /api/admin/health` | ✅ Admin | Admin-level system diagnostics |

## Prisma / Database

- **Prisma Client** is generated automatically via `postinstall` script
- **Migrations** are NOT run automatically on deploy
- To run migrations manually: `pnpm db:push` or `pnpm db:migrate`
- Ensure `POSTGRES_PRISMA_URL` is set before deployment

## What to Do If NextAuth Breaks on Preview URLs

Vercel preview deployments get unique URLs (e.g., `your-app-abc123.vercel.app`). This can break auth:

### Problem
NextAuth may reject callbacks because the preview URL doesn't match `NEXTAUTH_URL`.

### Solutions

1. **Use Vercel's automatic URL detection**: NextAuth on Vercel will use `VERCEL_URL` automatically if `NEXTAUTH_URL` is not set. For preview deployments, you can leave `NEXTAUTH_URL` unset and rely on this.

2. **Set NEXTAUTH_URL per environment**:
   - Production: `NEXTAUTH_URL=https://your-domain.com`
   - Preview: Leave unset (Vercel auto-detects)

3. **Cookie domain issues**: The app uses dynamic cookie domain detection based on the request hostname, so cookies should work across all Vercel deployment URLs automatically.

4. **Debug auth issues**: Visit `/api/auth/diagnostics` (requires `INTERNAL_API_KEY` header) to see the current auth configuration state.

## Troubleshooting

### Build fails with "Neither apiKey nor config.authenticator provided"
→ Set `STRIPE_SECRET_KEY` in environment variables. The Stripe client is lazy-initialized and won't crash during build, but requires the key at runtime.

### Build fails with TypeScript errors
→ Run `pnpm typecheck` locally to see errors. Fix in the source files.

### Database connection fails at runtime
→ Verify `POSTGRES_PRISMA_URL` and `NEXT_PUBLIC_SUPABASE_URL` are correct and the database is accessible from Vercel's network.

### Emails not sending
→ Set `RESEND_API_KEY`. The email service falls back to mock mode if it is not configured.
