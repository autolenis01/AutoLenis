# Database Migrations (Legacy)

These SQL scripts have been consolidated into the Supabase CLI baseline
migration at `supabase/migrations/00000000000000_initial_schema.sql`.

## Current Workflow

All new migrations are managed with the Supabase CLI:

```bash
# Link your project (one-time setup)
supabase link --project-ref dmtxwrzjmobxcfmveybl

# Create a new migration
supabase migration new <migration-name>

# Push all migrations to the database
supabase db push
```

Migration files live in `supabase/migrations/` and are applied in
lexicographic order.

## Legacy Scripts

The numbered SQL files in this directory were applied before the baseline
and are kept for historical reference only. Do **not** run them manually.
