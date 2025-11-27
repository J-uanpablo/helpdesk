/*
  Warnings:

  - You are about to drop the column `userId` on the `Ticket` table. All the data in the column will be lost.
  - Added the required column `createdById` to the `Ticket` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_userId_fkey";

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "userId",
ADD COLUMN     "assignedToId" INTEGER,
ADD COLUMN     "createdById" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "TicketHistory" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "changedById" INTEGER NOT NULL,
    "fromStatus" "TicketStatus",
    "toStatus" "TicketStatus",
    "fromAssignedToId" INTEGER,
    "toAssignedToId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketHistory" ADD CONSTRAINT "TicketHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketHistory" ADD CONSTRAINT "TicketHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
