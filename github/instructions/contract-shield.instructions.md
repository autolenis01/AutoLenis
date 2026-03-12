---
applyTo: "lib/services/contract-shield.service.ts|app/api/contract/**|app/api/admin/contract-shield/**|app/admin/contract-shield/**"
---
# Contract Shield (Non-Negotiable)

- Preserve gating invariants: SIGNING requires PASS or an override with full audit trail.
- Overrides requiring buyer acknowledgment must never be bypassed.
- All scan/override/ack changes must emit auditable events with actor + correlationId.
- Thresholds/tolerances must remain rules-driven and configurable.
- Add/maintain unit tests for:
  - APR variance,
  - OTD variance,
  - payment variance,
  - fix-list generation,
  - PASS/FAIL gating logic.
