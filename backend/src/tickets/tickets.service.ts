// src/tickets/tickets.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // 🔥 1) CREAR TICKET
  // ============================================================
  async create(data: any, userId: number) {
    return this.prisma.ticket.create({
      data: {
        ...data,
        createdById: userId, // Cambia el nombre si tu campo difiere
      },
    });
  }

  // ============================================================
  // 🔥 2) VER MIS TICKETS (solicitante)
  // ============================================================
  async findMy(userId: number) {
    return this.prisma.ticket.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================================
  // 🔥 3) VER TODOS LOS TICKETS (admin/soporte)
  // ============================================================
  async findAll() {
    return this.prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================================
  // 🔥 4) VER TICKET INDIVIDUAL
  // ============================================================
  async findOne(ticketId: number) {
    return this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
  }

  // ============================================================
  // 🔥 5) ACTUALIZAR ESTADO
  // ============================================================
  async updateStatus(
    ticketId: number,
    status: TicketStatus, // ← ya no string
    userId: number,
    note?: string,
  ) {
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status },
    });
  }

  // ============================================================
  // 🔥 6) ASIGNAR TICKET
  // ============================================================
  async assignTicket(
    ticketId: number,
    assignedToId: number,
    userId: number,
    note?: string,
  ) {
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { assignedToId },
    });
  }

  // ============================================================
  // 🔥 7) HISTORIAL (placeholder por si luego se implementa)
  // ============================================================
  async getHistory(ticketId: number) {
    return []; // Cuando quieras registro real, lo programamos.
  }

  // ============================================================
  // 🔥 8) CHAT - ENVIAR MENSAJE
  // ============================================================
  async addMessage(data: {
    ticketId: number;
    content: string;
    senderId: number;
  }) {
    return this.prisma.ticketMessage.create({
      data: {
        content: data.content,
        ticketId: data.ticketId,
        senderId: data.senderId,
      },
    });
  }

  // ============================================================
  // 🔥 9) CHAT - LISTAR MENSAJES
  // ============================================================
  async getMessages(ticketId: number) {
    return this.prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { name: true } }, // Cambia si tu modelo usa otro campo
      },
    });
  }

  // ============================================================
  // 🔥 10) LISTA RESUMIDA PARA EL PANEL (frontend tipo WhatsApp)
  // ============================================================
  async getTicketsForPanel() {
    const tickets = await this.prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { name: true } },
      },
    });

    return tickets.map((t: any) => ({
      id: t.id,
      subject: t.subject ?? t.title ?? t.asunto ?? null,
      status: t.status ?? null,
      createdAt: t.createdAt,
      requesterName: t.createdBy?.name ?? null,
    }));
  }
}
