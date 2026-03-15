-- Migration 108: Dealer Agreement System (DocuSign-backed)
-- Adds dealer_agreements table, docusign_connect_events ledger,
-- extends Dealer with agreement gating fields, storage bucket, and RLS.

-- ---------------------------------------------------------------------------
-- 1. Dealer Agreement Status Enum (informational — Prisma uses String)
-- ---------------------------------------------------------------------------

-- Note: Prisma manages status as string. This comment documents the values:
-- REQUIRED, DRAFTED, SENT, DELIVERED, VIEWED, SIGNED, COMPLETED, DECLINED, VOIDED, EXPIRED, ERROR

-- ---------------------------------------------------------------------------
-- 2. Create dealer_agreements table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "dealer_agreements" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "dealerId" TEXT NOT NULL,

  "version" TEXT NOT NULL,
  "agreementName" TEXT NOT NULL,
  "agreementType" TEXT NOT NULL DEFAULT 'DEALER_PARTICIPATION',

  "status" TEXT NOT NULL DEFAULT 'REQUIRED',

  "docusignAccountId" TEXT,
  "docusignTemplateId" TEXT,
  "docusignEnvelopeId" TEXT UNIQUE,
  "docusignRecipientId" TEXT,
  "docusignClientUserId" TEXT,

  "signerEmail" TEXT NOT NULL,
  "signerName" TEXT NOT NULL,
  "signerTitle" TEXT,

  "sentAt" TIMESTAMPTZ,
  "deliveredAt" TIMESTAMPTZ,
  "viewedAt" TIMESTAMPTZ,
  "signedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "voidedAt" TIMESTAMPTZ,
  "expiredAt" TIMESTAMPTZ,

  "lastWebhookAt" TIMESTAMPTZ,
  "webhookStatus" TEXT,
  "webhookPayload" JSONB NOT NULL DEFAULT '{}'::jsonb,

  "signedDocumentStoragePath" TEXT,
  "certificateStoragePath" TEXT,
  "summaryPdfStoragePath" TEXT,

  "createdBy" TEXT,
  "updatedBy" TEXT,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "dealer_agreements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dealer_agreements_dealerId_fkey"
    FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_dealer_agreements_dealer_id" ON "dealer_agreements" ("dealerId");
CREATE INDEX IF NOT EXISTS "idx_dealer_agreements_status" ON "dealer_agreements" ("status");
CREATE INDEX IF NOT EXISTS "idx_dealer_agreements_completed_at" ON "dealer_agreements" ("completedAt" DESC);

-- ---------------------------------------------------------------------------
-- 3. Create DocuSign Connect event ledger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "docusign_connect_events" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "eventHash" TEXT UNIQUE,
  "envelopeId" TEXT NOT NULL,

  "eventType" TEXT,
  "eventTime" TIMESTAMPTZ,
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "processedAt" TIMESTAMPTZ,
  "processingError" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "docusign_connect_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_docusign_connect_events_envelope_id"
  ON "docusign_connect_events" ("envelopeId");

CREATE INDEX IF NOT EXISTS "idx_docusign_connect_events_processed"
  ON "docusign_connect_events" ("processed", "createdAt" DESC);

-- ---------------------------------------------------------------------------
-- 4. Extend Dealer table with agreement gating fields
-- ---------------------------------------------------------------------------

ALTER TABLE "Dealer" ADD COLUMN IF NOT EXISTS "agreementRequired" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Dealer" ADD COLUMN IF NOT EXISTS "agreementCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Dealer" ADD COLUMN IF NOT EXISTS "agreementCompletedAt" TIMESTAMPTZ;
ALTER TABLE "Dealer" ADD COLUMN IF NOT EXISTS "docusignBlocked" BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 5. Storage bucket for dealer agreements
-- ---------------------------------------------------------------------------

-- file_size_limit: 52428800 bytes = 50 MB max PDF size
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dealer-agreements',
  'dealer-agreements',
  false,
  52428800,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. RLS Policies
-- ---------------------------------------------------------------------------

ALTER TABLE "dealer_agreements" ENABLE ROW LEVEL SECURITY;

-- Dealer can read own agreements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'dealer_agreement_dealer_read' AND tablename = 'dealer_agreements'
  ) THEN
    EXECUTE 'CREATE POLICY "dealer_agreement_dealer_read" ON "dealer_agreements" FOR SELECT USING (
      "dealerId" IN (
        SELECT "id" FROM "Dealer" WHERE "userId" = current_user_id()
      )
    )';
  END IF;
END $$;

-- DocuSign Connect events: no direct client access
ALTER TABLE "docusign_connect_events" ENABLE ROW LEVEL SECURITY;
