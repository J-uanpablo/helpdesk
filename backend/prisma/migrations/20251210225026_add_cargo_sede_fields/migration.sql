/*
  Warnings:

  - You are about to drop the column `title` on the `Ticket` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "title";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cargo" TEXT,
ADD COLUMN     "sede" TEXT;
