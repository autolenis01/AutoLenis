---
applyTo: "proxy.ts|middleware.ts|lib/auth*.ts|lib/admin-auth.ts|app/api/auth/**|app/api/admin/auth/**"
---
# Auth + RBAC (Non-Negotiable)

- Do NOT widen role access. Preserve strict buyer/dealer/affiliate/admin isolation.
- Email verification enforcement must remain intact for all roles.
- Admin auth must preserve MFA requirements if present.
- Add negative tests for:
  - wrong-role access to protected routes,
  - missing/expired session,
  - forbidden access returning correct status + error shape.
