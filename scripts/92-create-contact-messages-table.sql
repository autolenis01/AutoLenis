-- Create contact_messages table for storing contact form submissions
-- This script is idempotent and can be run multiple times safely

DO $$
BEGIN
  -- Create the table if it doesn't exist
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contact_messages') THEN
    CREATE TABLE "contact_messages" (
      "id" TEXT PRIMARY KEY,
      "first_name" TEXT NOT NULL,
      "last_name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "phone" TEXT,
      "subject" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "status" TEXT DEFAULT 'new',
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      "responded_at" TIMESTAMP WITH TIME ZONE,
      "notes" TEXT
    );

    -- Create index for faster lookups
    CREATE INDEX IF NOT EXISTS "idx_contact_messages_email" ON "contact_messages" ("email");
    CREATE INDEX IF NOT EXISTS "idx_contact_messages_status" ON "contact_messages" ("status");
    CREATE INDEX IF NOT EXISTS "idx_contact_messages_created_at" ON "contact_messages" ("created_at" DESC);

    RAISE NOTICE 'Created contact_messages table';
  ELSE
    RAISE NOTICE 'contact_messages table already exists';
  END IF;
END $$;
