-- CreateEnum
CREATE TYPE "public"."NodeCategory" AS ENUM ('Root', 'Why', 'Cause', 'Action');

-- CreateTable
CREATE TABLE "public"."Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Board" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "boardKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Node" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "nodeKey" TEXT,
    "content" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "category" "public"."NodeCategory" NOT NULL DEFAULT 'Why',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prevNodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nextNodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adopted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "public"."Tenant"("slug");

-- CreateIndex
CREATE INDEX "Board_tenantId_idx" ON "public"."Board"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Board_tenantId_boardKey_key" ON "public"."Board"("tenantId", "boardKey");

-- CreateIndex
CREATE INDEX "Node_tenantId_boardId_idx" ON "public"."Node"("tenantId", "boardId");

-- CreateIndex
CREATE UNIQUE INDEX "Node_tenantId_boardId_nodeKey_key" ON "public"."Node"("tenantId", "boardId", "nodeKey");

-- AddForeignKey
ALTER TABLE "public"."Board" ADD CONSTRAINT "Board_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Node" ADD CONSTRAINT "Node_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Node" ADD CONSTRAINT "Node_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "public"."Board"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
