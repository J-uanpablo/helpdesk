// src/tickets/tickets.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketPriority, TicketStatus } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  // ================== TICKETS BÁSICOS ==================

  // Crear ticket
  async create(
    data: {
      title: string;
      description: string;
      priority?: TicketPriority | string;
    },
    userId: number,
  ) {
    const priority =
      typeof data.priority === 'string'
        ? (data.priority as TicketPriority)
        : (data.priority ?? TicketPriority.MEDIUM);

    return this.prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        priority,
        createdById: userId,
      },
    });
  }

  // Ver mis tickets
  async findMy(userId: number) {
    return this.prisma.ticket.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Ver todos los tickets (admin/soporte)
  async findAll() {
    return this.prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // Buscar un ticket por id
  async findOne(id: number) {
    return this.prisma.ticket.findUnique({
      where: { id },
    });
  }

  // Cambiar estado de un ticket
  async updateStatus(
    ticketId: number,
    status: TicketStatus | string,
    changedById: number,
    note?: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) return null;

    const newStatus =
      typeof status === 'string' ? (status as TicketStatus) : status;

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: newStatus },
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId,
        changedById,
        fromStatus: ticket.status,
        toStatus: newStatus,
        fromAssignedToId: ticket.assignedToId,
        toAssignedToId: ticket.assignedToId,
        note: note ?? null,
      },
    });

    return updated;
  }

  // Asignar ticket a un usuario
  async assignTicket(
    ticketId: number,
    assignedToId: number,
    changedById: number,
    note?: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) return null;

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { assignedToId },
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId,
        changedById,
        fromStatus: ticket.status,
        toStatus: ticket.status,
        fromAssignedToId: ticket.assignedToId,
        toAssignedToId: assignedToId,
        note: note ?? null,
      },
    });

    return updated;
  }

  // Historial del ticket
  async getHistory(ticketId: number) {
    return this.prisma.ticketHistory.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: {
        changedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  // ================== CHAT INTERNO ==================

  // Crear mensaje en el chat del ticket
  async addMessage(ticketId: number, senderId: number, content: string) {
    return this.prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId,
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  // Listar mensajes del chat del ticket
  async getMessages(ticketId: number) {
    return this.prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }
}
