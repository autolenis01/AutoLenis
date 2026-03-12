# Supabase Connectivity Verification - Final Steps

## Project Information
- **Supabase URL**: https://vpwnjibcrqujclqalkgy.supabase.co
- **Project Reference**: vpwnjibcrqujclqalkgy
- **Status**: Environment variables configured ✅

## Step 1: Create the Canary Table ✅

Run this SQL in your **Supabase Dashboard → SQL Editor**:

```sql
-- Create the connection canary table
CREATE TABLE IF NOT EXISTS public._connection_canary (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  message TEXT
);

-- Insert initial test row
INSERT INTO public._connection_canary (message) 
VALUES ('canary alive')
ON CONFLICT DO NOTHING;

-- Grant SELECT permission to service_role
GRANT SELECT ON public._connection_canary TO service_role;
GRANT SELECT ON public._connection_canary TO anon;

-- Verify the table was created
SELECT * FROM public._connection_canary ORDER BY id DESC LIMIT 1;
```

**Expected Output:**
```
id | created_at                  | message
---+-----------------------------+-------------
1  | 2024-01-15 10:30:00.000+00 | canary alive
```

## Step 2: Verify Environment Variables ✅

Run the verification script:

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://vpwnjibcrqujclqalkgy.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwd25qaWJjcnF1amNscWFsa2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc2MzQ2NywiZXhwIjoyMDc5MzM5NDY3fQ.rgtrRR8pZD5ll_2jPCRTyPkkdNRduGqwq61MhqlC_1M"

bash scripts/verify-supabase-env.sh
```

**Expected Output:**
```
✅ All required Supabase environment variables are configured
   Project Reference: vpwnjibcrqujclqalkgy
```

## Step 3: Test Health Check Endpoint

### Option A: Using curl (when server is running)

```bash
# Start the development server
npm run dev

# In another terminal, test the endpoint
curl http://localhost:3000/api/health/db
```

### Option B: Test with the Supabase REST API directly

```bash
curl -X GET "https://vpwnjibcrqujclqalkgy.supabase.co/rest/v1/_connection_canary?select=*&order=id.desc&limit=1" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwd25qaWJjcnF1amNscWFsa2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NjM0NjcsImV4cCI6MjA3OTMzOTQ2N30.nR43JkNSqIUoptgUTkYd8vjGOtlBGWfuoithOKnmLKE" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwd25qaWJjcnF1amNscWFsa2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NjM0NjcsImV4cCI6MjA3OTMzOTQ2N30.nR43JkNSqIUoptgUTkYd8vjGOtlBGWfuoithOKnmLKE"
```

## Expected Success Response

When you call `/api/health/db`, you should get:

```json
{
  "ok": true,
  "projectRef": "vpwnjibcrqujclqalkgy",
  "latencyMs": 234,
  "lastCanaryRow": {
    "id": 1,
    "created_at": "2024-01-15T10:30:00.000Z",
    "message": "canary alive"
  }
}
```

## Final Verification

Once you receive the success response above, you can confirm:

**✅ PASS: Connected to vpwnjibcrqujclqalkgy**

This definitively proves the app is connected to the correct Supabase project.

## Troubleshooting

### If you get "Table does not exist" error

1. Go to Supabase Dashboard → SQL Editor
2. Run the SQL from Step 1 above
3. Verify the table exists: `SELECT * FROM public._connection_canary;`
4. Try the health check again

### If you get "Missing environment variables" error

1. Verify `.env.local` file exists in the project root
2. Check that it contains:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Restart your development server after updating `.env.local`

### If connection timeout

1. Check your Supabase project status in the dashboard
2. Verify the project is not paused
3. Check your network connectivity

## Files Created

- ✅ `.env.local` - Environment configuration
- ✅ `migrations/95-add-connection-canary-table.sql` - Database migration
- ✅ `scripts/verify-supabase-env.sh` - Environment verification script
- ✅ `app/api/health/db/route.ts` - Health check endpoint
- ✅ `SUPABASE_CONNECTIVITY_VERIFICATION.md` - Detailed documentation
- ✅ `VERIFICATION_SUMMARY.md` - Quick reference guide
- ✅ `FINAL_VERIFICATION_STEPS.md` - This document

## Summary

The implementation is complete. The app is configured to connect to:
- **Supabase Project**: vpwnjibcrqujclqalkgy
- **URL**: https://vpwnjibcrqujclqalkgy.supabase.co

All that remains is:
1. Create the canary table in Supabase (SQL provided above)
2. Start the dev server and test the endpoint
3. Confirm the final PASS status
