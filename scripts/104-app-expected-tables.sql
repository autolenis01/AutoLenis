-- ==========================================================================
-- SEO Tables — PascalCase with camelCase columns
--
-- The application code (lib/services/seo.service.ts) queries tables named
-- "SeoPages", "SeoSchema", "SeoHealth", "SeoKeywords" with camelCase
-- column names like "pageKey", "canonicalUrl", "ogTitle", etc.
--
-- This script creates these tables in the format the application expects.
-- If the snake_case versions (seo_pages, etc.) already exist with data,
-- the data can be migrated separately.
--
-- Idempotent — safe to re-run.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. SeoPages
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "SeoPages" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pageKey"         TEXT UNIQUE NOT NULL,
  "title"           TEXT,
  "description"     TEXT,
  "keywords"        TEXT,
  "canonicalUrl"    TEXT,
  "ogTitle"         TEXT,
  "ogDescription"   TEXT,
  "ogImageUrl"      TEXT,
  "robotsRule"      TEXT DEFAULT 'index, follow',
  "indexable"       BOOLEAN DEFAULT true,
  "createdAt"       TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "SeoPages_pageKey_idx" ON "SeoPages"("pageKey");

-- --------------------------------------------------------------------------
-- 2. SeoSchema
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "SeoSchema" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pageKey"         TEXT NOT NULL,
  "schemaType"      TEXT NOT NULL,
  "schemaJson"      JSONB NOT NULL,
  "createdAt"       TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("pageKey", "schemaType")
);

CREATE INDEX IF NOT EXISTS "SeoSchema_pageKey_idx" ON "SeoSchema"("pageKey");

-- --------------------------------------------------------------------------
-- 3. SeoHealth
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "SeoHealth" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pageKey"         TEXT UNIQUE NOT NULL,
  "score"           INTEGER DEFAULT 0,
  "issuesJson"      JSONB DEFAULT '[]'::jsonb,
  "lastScanAt"      TIMESTAMPTZ DEFAULT NOW(),
  "createdAt"       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "SeoHealth_pageKey_idx" ON "SeoHealth"("pageKey");

-- --------------------------------------------------------------------------
-- 4. SeoKeywords
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "SeoKeywords" (
  "id"                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pageKey"             TEXT UNIQUE NOT NULL,
  "primaryKeyword"      TEXT,
  "secondaryKeywords"   JSONB DEFAULT '[]'::jsonb,
  "targetDensity"       DECIMAL DEFAULT 2.5,
  "actualDensity"       DECIMAL DEFAULT 0,
  "createdAt"           TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "SeoKeywords_pageKey_idx" ON "SeoKeywords"("pageKey");

-- --------------------------------------------------------------------------
-- 5. InventoryImportLog (used by dealer inventory bulk upload)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "InventoryImportLog" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "dealerId"        TEXT NOT NULL,
  "userId"          TEXT,
  "fileName"        TEXT NOT NULL,
  "fileSize"        BIGINT,
  "totalRows"       INTEGER DEFAULT 0,
  "successRows"     INTEGER DEFAULT 0,
  "failedRows"      INTEGER DEFAULT 0,
  "errors"          JSONB DEFAULT '[]'::jsonb,
  "status"          TEXT DEFAULT 'pending',
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "InventoryImportLog_dealerId_idx" ON "InventoryImportLog"("dealerId");
CREATE INDEX IF NOT EXISTS "InventoryImportLog_createdAt_idx" ON "InventoryImportLog"("createdAt" DESC);

-- --------------------------------------------------------------------------
-- 6. RLS — service-role only for all new tables
-- --------------------------------------------------------------------------
ALTER TABLE "SeoPages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoSchema" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoHealth" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoKeywords" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryImportLog" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SeoPages: service role bypass" ON "SeoPages";
CREATE POLICY "SeoPages: service role bypass"
  ON "SeoPages" FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "SeoSchema: service role bypass" ON "SeoSchema";
CREATE POLICY "SeoSchema: service role bypass"
  ON "SeoSchema" FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "SeoHealth: service role bypass" ON "SeoHealth";
CREATE POLICY "SeoHealth: service role bypass"
  ON "SeoHealth" FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "SeoKeywords: service role bypass" ON "SeoKeywords";
CREATE POLICY "SeoKeywords: service role bypass"
  ON "SeoKeywords" FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "InventoryImportLog: service role bypass" ON "InventoryImportLog";
CREATE POLICY "InventoryImportLog: service role bypass"
  ON "InventoryImportLog" FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- --------------------------------------------------------------------------
-- 7. Migrate data from snake_case to PascalCase tables (if source exists)
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'seo_pages')
    AND NOT EXISTS (SELECT 1 FROM "SeoPages" LIMIT 1) THEN
    INSERT INTO "SeoPages" ("id", "pageKey", "title", "description", "keywords",
      "canonicalUrl", "ogTitle", "ogDescription", "ogImageUrl", "robotsRule",
      "indexable", "createdAt", "updatedAt")
    SELECT id, page_key, title, description, keywords,
      canonical_url, og_title, og_description, og_image_url, robots_rule,
      indexable, created_at, updated_at
    FROM seo_pages
    ON CONFLICT ("pageKey") DO NOTHING;
  END IF;
END $$;
