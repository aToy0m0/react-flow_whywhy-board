-- Create board lifecycle columns and enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BoardStatus') THEN
        CREATE TYPE "BoardStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FINALIZED', 'ARCHIVED');
    END IF;
END $$;

ALTER TABLE "Board"
    ADD COLUMN IF NOT EXISTS "status" "BoardStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- backfill null status values just in case
UPDATE "Board" SET "status" = 'ACTIVE' WHERE "status" IS NULL;

-- indexes matching Prisma schema
CREATE INDEX IF NOT EXISTS "Board_tenantId_status_idx" ON "Board" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Board_tenantId_deletedAt_idx" ON "Board" ("tenantId", "deletedAt");
