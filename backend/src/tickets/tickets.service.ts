// src/tickets/tickets.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // 🔥 1) CREAR TICKET
  // ============================================================
  async create(data: any, userId: number) {
    const subject: string | undefined = data.subject?.trim();
    const description: string | undefined = data.description?.trim();
    const area: string | undefined = data.area?.trim();

    if (!subject || !description) {
      throw new BadRequestException(
        'Debes enviar subject y description para crear un ticket',
      );
    }

    if (!area) {
      throw new BadRequestException(
        'Debes seleccionar un área válida para el ticket',
      );
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        title: subject,
        description,
        area,
        createdById: userId,
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        area: true,
      },
    });

    // Primer mensaje automático (descripción)
    await this.prisma.ticketMessage.create({
      data: {
        content: description,
        ticketId: ticket.id,
        senderId: userId,
      },
    });

    return {
      id: ticket.id,
      subject: ticket.title,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      area: ticket.area,
    };
  }

  // ============================================================
  // 🔥 2) VER MIS TICKETS (CLIENTE)
  // ============================================================
  async findMy(userId: number) {
    const rows = await this.prisma.ticket.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        area: true,
      },
    });

    return rows.map((t) => ({
      id: t.id,
      subject: t.title,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      area: t.area,
    }));
  }

  // ============================================================
  // 🔥 3) VER TODOS LOS TICKETS (ADMIN)
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
      include: {
        createdBy: { select: { name: true, email: true } },
        assignedTo: { select: { name: true, email: true } },
      },
    });
  }

  // ============================================================
  // 🔥 5) CAMBIAR ESTADO DEL TICKET
  // ============================================================
  async updateStatus(
    ticketId: number,
    status: TicketStatus,
    userId: number,
    note?: string,
  ) {
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status },
    });
  }

  // ============================================================
  // 🔥 6) ASIGNAR TICKET A UN AGENTE
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
  // 🔥 7) HISTORIAL (por implementar)
  // ============================================================
  async getHistory(ticketId: number) {
    return [];
  }

  // ============================================================
  // 🔥 8) AÑADIR MENSAJE AL CHAT
  //      → ACTUALIZA updatedAt AUTOMÁTICAMENTE
  // ============================================================
  async addMessage(data: {
    ticketId: number;
    content: string;
    senderId: number;
  }) {
    const { ticketId, content, senderId } = data;

    const result = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.ticketMessage.create({
        data: { content, ticketId, senderId },
        include: {
          sender: { select: { name: true } },
        },
      });

      await tx.ticket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() },
      });

      return msg;
    });

    return {
      id: result.id,
      content: result.content,
      ticketId: result.ticketId,
      senderId: result.senderId,
      createdAt: result.createdAt,
      senderName: result.sender?.name ?? null,
    };
  }

  // ============================================================
  // 🔥 9) LISTAR MENSAJES DE UN TICKET
  // ============================================================
  async getMessages(ticketId: number) {
    const msgs = await this.prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { name: true } },
      },
    });

    return msgs.map((m) => ({
      id: m.id,
      content: m.content,
      ticketId: m.ticketId,
      senderId: m.senderId,
      createdAt: m.createdAt,
      senderName: m.sender?.name ?? null,
    }));
  }

  // ============================================================
  // 🔥 10) LISTA RESUMIDA PARA EL PANEL DE ADMIN / AGENTE
  // ============================================================
  async getTicketsForPanel(currentUser?: { id: number; roles?: string[] }) {
    const isAdmin = currentUser?.roles?.includes('admin') ?? false;

    const where: any = {};

    if (!isAdmin && currentUser) {
      where.assignedToId = currentUser.id;
    }

    const tickets = await this.prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    });

    return tickets.map((t: any) => ({
      id: t.id,
      subject: t.title,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      requesterName: t.createdBy?.name ?? null,
      area: t.area ?? null,
      assignedToId: t.assignedToId ?? null,
      assignedToName: t.assignedTo?.name ?? null,
    }));
  }
}
