/*
  Warnings:

  - Added the required column `originalName` to the `TicketAttachment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TicketAttachment" ADD COLUMN     "originalName" TEXT NOT NULL;
