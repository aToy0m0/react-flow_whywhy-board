-- Add tenantId / boardId columns to NodeLock for scoped queries
ALTER TABLE "NodeLock" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "NodeLock" ADD COLUMN "boardId" TEXT;

-- Backfill scope columns from related nodes
UPDATE "NodeLock" AS nl
SET "tenantId" = n."tenantId",
    "boardId" = n."boardId"
FROM "Node" AS n
WHERE nl."nodeId" = n."id"
  AND (nl."tenantId" IS NULL OR nl."boardId" IS NULL);

-- Enforce non-null after backfill
ALTER TABLE "NodeLock" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "NodeLock" ALTER COLUMN "boardId" SET NOT NULL;

-- Create scoped indexes to speed up NodeLock lookups per board/tenant
CREATE INDEX "NodeLock_tenantId_boardId_isActive_idx" ON "NodeLock"("tenantId", "boardId", "isActive");
CREATE INDEX "NodeLock_boardId_isActive_idx" ON "NodeLock"("boardId", "isActive");

-- Strengthen referential integrity
ALTER TABLE "NodeLock"
  ADD CONSTRAINT "NodeLock_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NodeLock"
  ADD CONSTRAINT "NodeLock_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
