---
applyTo: "lib/services/affiliate.service.ts|app/api/affiliate/**|app/api/webhooks/**commission**"
---
# Affiliate Engine (Non-Negotiable)

- Enforce: no self-referrals; prevent loops; max depth 5.
- Commissions accrue only on successful revenue events (e.g., concierge fee success).
- Refunds must reverse commissions atomically with payment reversal.
- Enforce strict data isolation: affiliates only see their own referrals/commissions/payouts.
- Add/maintain unit tests for referral chain build + reversal semantics.
