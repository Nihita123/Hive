-- Add createdBy to Project, backfilling existing rows with the room owner
-- so the NOT NULL constraint is satisfied without data loss.

-- Step 1: add as nullable
ALTER TABLE "Project" ADD COLUMN "createdBy" TEXT;

-- Step 2: backfill — set createdBy to the owning room's ownerId
UPDATE "Project" p
SET "createdBy" = (SELECT "ownerId" FROM "Room" r WHERE r.id = p."roomId");

-- Step 3: make NOT NULL now that all rows have a value
ALTER TABLE "Project" ALTER COLUMN "createdBy" SET NOT NULL;

-- CreateTable
CREATE TABLE "RoomInvite" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomInvite_code_key" ON "RoomInvite"("code");

-- CreateIndex
CREATE INDEX "RoomInvite_code_idx" ON "RoomInvite"("code");

-- CreateIndex
CREATE INDEX "RoomInvite_roomId_idx" ON "RoomInvite"("roomId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomInvite" ADD CONSTRAINT "RoomInvite_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomInvite" ADD CONSTRAINT "RoomInvite_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
