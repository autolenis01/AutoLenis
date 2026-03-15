# AutoLenis + Supabase Integration - QUICK REFERENCE

## Status
✅ **FULLY INTEGRATED & PRODUCTION READY**

## Key Facts
- **Database:** Supabase PostgreSQL
- **Project Ref:** dmtxwrzjmobxcfmveybl
- **Tables:** 88 (all Prisma models)
- **RLS Policies:** 217 active
- **Auth:** Supabase Auth (JWT + cookies)
- **Migrations:** 1 baseline tracked

## Quick Commands

### Validation Scripts
```bash
npm run integration:all           # Run all phases (1-4)
npm run integration:phase1        # Pre-integration check
npm run integration:phase2        # Data fetching validation
npm run integration:phase3        # Security verification
npm run integration:phase4        # Performance benchmark
```

### Database Management
```bash
npm run db:push                   # Push Prisma schema
npm run db:studio                 # Open Prisma Studio
prisma generate                   # Regenerate Prisma client
supabase db push                  # Apply migrations
supabase migration new add_table  # Create new migration
```

### Development
```bash
npm run dev                       # Start dev server
npm run build                     # Build for production
npm run typecheck                 # Check TypeScript
npm run lint                      # Run linter
```

## Documentation Map

| Document | Purpose |
|----------|---------|
| `INTEGRATION_COMPLETE.md` | Master integration guide (START HERE) |
| `INTEGRATION_SUMMARY.md` | Executive summary & deployment checklist |
| `INTEGRATION_PHASE_1_REPORT.md` | Phase 1 verification results |
| `INTEGRATION_PHASES_5_AND_6.md` | E2E tests & maintenance procedures |
| `README.md` | Project overview |

## Common Tasks

### Add a New Table
1. Update `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name add_table`
3. Create Supabase migration: `supabase migration new add_table`
4. Add RLS policies
5. Run `supabase db push`
6. Verify: `npm run integration:phase1`

### Deploy Changes
1. Make changes
2. Test: `npm run integration:all`
3. Commit: `git add . && git commit -m "..."`
4. Push: `git push`
5. Merge to main (CI runs automatically)
6. Deploy to production

### Fix RLS Issues
```sql
-- Check policies
SELECT * FROM pg_policies WHERE tablename='table_name'

-- Drop and recreate
DROP POLICY policy_name ON table_name
CREATE POLICY new_policy ON table_name
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id)
```

### Debug Query Issues
```typescript
// Enable Prisma logging
prisma.$on('query', (e) => console.log(e.query))

// Use db:studio to inspect
npm run db:studio
```

## Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=postgresql://...
```

## Database Schema Groups

| Group | Tables | Purpose |
|-------|--------|---------|
| Auth | 4 | User accounts & admin roles |
| Buyer | 4 | Buyer profiles & preferences |
| Dealer | 3 | Dealer orgs & inventory |
| Auction | 5 | Vehicle auctions & offers |
| Payment | 9 | Deposits, fees, commissions |
| Platform | 10 | Email, AI, notifications, etc |
| SEO | 4 | Content & keywords |
| Sourcing | 8+ | Vehicle sourcing operations |

## Security Levels

**Public (Anonymous):**
- Vehicle listings (read-only)
- Inventory items (read-only)
- Contact form submissions (write-only)

**Authenticated Users:**
- Own profile data
- Associated records (workspace, buyer/dealer scope)
- Limited by RLS policies

**Admins:**
- Full cross-workspace access
- Audit logs & system operations
- Admin-only tables (AdminUser, AdminAuditLog)

**Super Admins:**
- All admin permissions
- User management
- System configuration

## Performance Targets

| Operation | Target | Status |
|-----------|--------|--------|
| Single query | < 500ms | ✅ |
| JOIN query | < 750ms | ✅ |
| Bulk operation | < 1000ms | ✅ |
| Transaction | < 1500ms | ✅ |

## Health Check (Daily)

```bash
#!/bin/bash
psql $DATABASE_URL -c "SELECT 1"           # Connection check
npm run integration:phase1                 # Schema status
# Check error logs in AdminAuditLog
```

## Backup Procedure (Weekly)

```bash
PGPASSWORD=$DB_PASSWORD pg_dump \
  postgresql://user:pass@host/db | \
  gzip > backup_$(date +%Y%m%d).sql.gz
aws s3 cp backup_$(date +%Y%m%d).sql.gz s3://autolenis-backups/
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection timeout | Check DATABASE_URL, test psql directly |
| RLS blocking query | Check policy condition, verify user role |
| Data not syncing | Run `prisma db push`, check for migrations |
| Slow queries | Run Phase 4 benchmarks, check for N+1 queries |
| Auth failing | Verify NEXT_PUBLIC_SUPABASE_URL is correct |

## Team Contacts

- **Database Admin:** [Your Name]
- **Security Lead:** [Your Name]
- **DevOps:** [Your Name]

## Links

- **Supabase Dashboard:** https://app.supabase.com
- **Prisma Docs:** https://www.prisma.io/docs/
- **Supabase Docs:** https://supabase.com/docs
- **GitHub Issues:** https://github.com/autolenis01/AutoLenis/issues

## Latest Updates

- **March 13, 2026** - Integration completed, all phases validated
- **Baseline Migration** - 20260313182816_new_migration (RLS + functions)
- **Next Review** - June 13, 2026 (Quarterly)

---

**Project Status:** ✅ FULLY INTEGRATED & APPROVED FOR PRODUCTION

For detailed information, see `INTEGRATION_COMPLETE.md`
