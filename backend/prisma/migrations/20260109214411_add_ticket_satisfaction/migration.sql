-- CreateTable
CREATE TABLE "TicketSatisfaction" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketSatisfaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketSatisfaction_ticketId_key" ON "TicketSatisfaction"("ticketId");

-- CreateIndex
CREATE INDEX "TicketSatisfaction_rating_idx" ON "TicketSatisfaction"("rating");

-- CreateIndex
CREATE INDEX "TicketSatisfaction_createdAt_idx" ON "TicketSatisfaction"("createdAt");

-- AddForeignKey
ALTER TABLE "TicketSatisfaction" ADD CONSTRAINT "TicketSatisfaction_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
