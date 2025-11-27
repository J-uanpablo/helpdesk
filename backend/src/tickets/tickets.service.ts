// src/tickets/tickets.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketPriority, TicketStatus } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  // Crear ticket: guarda en createdById
  create(
    data: { title: string; description: string; priority?: TicketPriority },
    userId: number,
  ) {
    return this.prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority ?? TicketPriority.MEDIUM,
        createdById: userId, // 👈 antes era userId
      },
    });
  }

  // Mis tickets = los que YO creé
  findMy(userId: number) {
    return this.prisma.ticket.findMany({
      where: { createdById: userId }, // 👈 antes where: { userId }
      orderBy: { createdAt: 'desc' },
    });
  }

  findAll() {
    return this.prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.ticket.findUnique({
      where: { id },
    });
  }

  // Cambiar estado
  async updateStatus(
    ticketId: number,
    newStatus: TicketStatus,
    userId: number,
    note?: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.ticket.update({
        where: { id: ticketId },
        data: { status: newStatus },
      });

      await tx.ticketHistory.create({
        data: {
          ticketId,
          changedById: userId,
          fromStatus: ticket.status,
          toStatus: newStatus,
          fromAssignedToId: ticket.assignedToId,
          toAssignedToId: ticket.assignedToId,
          note,
        },
      });

      return updatedTicket;
    });

    return updated;
  }

  // Asignar ticket a un agente
  async assignTicket(
    ticketId: number,
    assignedToId: number,
    currentUserId: number,
    note?: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.ticket.update({
        where: { id: ticketId },
        data: { assignedToId },
      });

      await tx.ticketHistory.create({
        data: {
          ticketId,
          changedById: currentUserId,
          fromStatus: ticket.status,
          toStatus: ticket.status,
          fromAssignedToId: ticket.assignedToId,
          toAssignedToId: assignedToId,
          note,
        },
      });

      return updatedTicket;
    });

    return updated;
  }

  // Historial del ticket
  async getHistory(ticketId: number) {
    return this.prisma.ticketHistory.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: {
        changedBy: true,
      },
    });
  }
}
