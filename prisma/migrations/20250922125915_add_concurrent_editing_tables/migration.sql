-- CreateTable
CREATE TABLE "public"."NodeLock" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlockedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodeLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NodeEdit" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NodeEdit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NodeLock_nodeId_isActive_idx" ON "public"."NodeLock"("nodeId", "isActive");

-- CreateIndex
CREATE INDEX "NodeLock_lockedAt_idx" ON "public"."NodeLock"("lockedAt");

-- CreateIndex
CREATE INDEX "NodeEdit_nodeId_createdAt_idx" ON "public"."NodeEdit"("nodeId", "createdAt");

-- CreateIndex
CREATE INDEX "NodeEdit_userId_createdAt_idx" ON "public"."NodeEdit"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."NodeLock" ADD CONSTRAINT "NodeLock_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "public"."Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NodeLock" ADD CONSTRAINT "NodeLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NodeEdit" ADD CONSTRAINT "NodeEdit_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "public"."Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NodeEdit" ADD CONSTRAINT "NodeEdit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
