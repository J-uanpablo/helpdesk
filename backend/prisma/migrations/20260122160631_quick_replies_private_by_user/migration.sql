/*
  Warnings:

  - You are about to drop the column `area` on the `QuickReply` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "QuickReply" DROP CONSTRAINT "QuickReply_createdById_fkey";

-- DropIndex
DROP INDEX "QuickReply_area_idx";

-- AlterTable
ALTER TABLE "QuickReply" DROP COLUMN "area";

-- CreateIndex
CREATE INDEX "QuickReply_isActive_idx" ON "QuickReply"("isActive");

-- CreateIndex
CREATE INDEX "QuickReply_createdAt_idx" ON "QuickReply"("createdAt");

-- AddForeignKey
ALTER TABLE "QuickReply" ADD CONSTRAINT "QuickReply_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
