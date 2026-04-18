// src/tickets/tickets.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';
import { TicketSatisfactionDto } from './dto/ticket-satisfaction.dto';

// ✅ EMAIL
import { sendMail } from '../services/mailer';
import {
  ticketCreatedEmail,
  ticketClosedWithTranscriptEmail,
} from '../emails/templates';
import { buildTranscriptHtml } from '../services/transcript';

type CurrentUser = { id: number; roles?: string[] };

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  private isSuperAdmin(user: CurrentUser) {
    return (user.roles || []).includes('super-admin');
  }
  private isAdmin(user: CurrentUser) {
    const r = user.roles || [];
    return r.includes('admin') || r.includes('super-admin');
  }
  private isSupport(user: CurrentUser) {
    return (user.roles || []).includes('support');
  }

  // ============================================================
  // HELPERS EMAIL
  // ============================================================
  private getAppUrl() {
    return process.env.APP_URL || 'http://192.168.16.33:5173';
  }

  /**
   * Enviar email al crear ticket:
   * - Siempre al cliente (creador)
   * - Si ticket tiene assignedToId => a ese agente
   * - Si NO tiene assignedToId => a todos los agentes del área (supportArea = area)
   */
  private async notifyTicketCreated(params: {
    ticketId: number;
    subject: string;
    area: string | null;
    createdById: number;
    assignedToId?: number | null;
  }) {
    try {
      const appUrl = this.getAppUrl();

      const client = await this.prisma.user.findUnique({
        where: { id: params.createdById },
        select: { id: true, name: true, email: true },
      });

      if (!client?.email) return;

      let agentEmails: string[] = [];
      let agentName = 'Agente';

      // 1) Si ya hay agente asignado, enviar solo a ese agente
      if (params.assignedToId) {
        const agent = await this.prisma.user.findUnique({
          where: { id: params.assignedToId },
          select: { id: true, name: true, email: true },
        });

        if (agent?.email) {
          agentEmails = [agent.email];
          agentName = agent.name || 'Agente';
        }
      }
      // 2) Si NO hay agente asignado, enviar a agentes del área (solo si area existe)
      else if (params.area) {
        const agents = await this.prisma.user.findMany({
          where: { supportArea: params.area },
          select: { email: true, name: true },
        });

        agentEmails = agents
          .map((u) => u.email)
          .filter((e): e is string => Boolean(e));

        agentName = agents.length ? `Equipo ${params.area}` : 'Agente';
      }

      const recipients = Array.from(
        new Set([client.email, ...agentEmails].filter(Boolean)),
      );

      if (!recipients.length) return;

      await sendMail({
        to: recipients,
        subject: `Nuevo ticket #${params.ticketId} - ${params.subject}`,
        html: ticketCreatedEmail({
          ticketId: params.ticketId,
          subject: params.subject,
          clientName: client.name || 'Cliente',
          agentName,
          appUrl,
        }),
      });
    } catch (error) {
      // Nunca romper creación del ticket por fallo SMTP
      console.error('❌ Error enviando email de ticket creado:', error);
    }
  }

  /**
   * Enviar email al cerrar ticket con transcripción completa del chat
   * - Cliente + agente asignado (si existe)
   */
  private async notifyTicketClosed(params: {
    ticketId: number;
    closedByUserId: number;
  }) {
    try {
      const appUrl = this.getAppUrl();

      const ticket = await this.prisma.ticket.findUnique({
        where: { id: params.ticketId },
        include: {
          createdBy: { select: { name: true, email: true } },
          assignedTo: { select: { name: true, email: true } },
        },
      });

      if (!ticket) return;

      const closer = await this.prisma.user.findUnique({
        where: { id: params.closedByUserId },
        select: { name: true },
      });

      const msgs = await this.prisma.ticketMessage.findMany({
        where: { ticketId: params.ticketId },
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: { name: true } } },
      });

      const transcriptHtml = buildTranscriptHtml(
        msgs.map((m) => ({
          createdAt: m.createdAt,
          senderName: m.sender?.name || 'Usuario',
          content: m.content || '',
        })),
      );

      const recipients = Array.from(
        new Set(
          [ticket.createdBy?.email, ticket.assignedTo?.email].filter(
            Boolean,
          ) as string[],
        ),
      );

      if (!recipients.length) return;

      await sendMail({
        to: recipients,
        subject: `Ticket cerrado #${ticket.id} - ${ticket.subject}`,
        html: ticketClosedWithTranscriptEmail({
          ticketId: ticket.id,
          subject: ticket.subject,
          closedBy: closer?.name || 'Sistema',
          appUrl,
          transcriptHtml,
        }),
      });
    } catch (error) {
      console.error('❌ Error enviando email de ticket cerrado:', error);
    }
  }

  // ============================================================
  // NUEVO: ESTADO DE COLA POR ÁREA
  // ============================================================
  async getQueueStatus(ticketId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        area: true,
        status: true,
        createdAt: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }

    // Si ya está siendo atendido, el cliente ya puede escribir
    if (ticket.status === TicketStatus.IN_PROGRESS) {
      const totalPendingInArea = await this.prisma.ticket.count({
        where: {
          area: ticket.area,
          status: TicketStatus.PENDING,
        },
      });

      return {
        ticketId: ticket.id,
        area: ticket.area,
        status: ticket.status,
        queuePosition: 0,
        waitingBefore: 0,
        totalPendingInArea,
        canChat: true,
      };
    }

    // Si ya no está en cola
    if (
      ticket.status === TicketStatus.RESOLVED ||
      ticket.status === TicketStatus.CLOSED
    ) {
      return {
        ticketId: ticket.id,
        area: ticket.area,
        status: ticket.status,
        queuePosition: 0,
        waitingBefore: 0,
        totalPendingInArea: 0,
        canChat: false,
      };
    }

    // Cola: solo PENDING del mismo área, por orden de creación
    const pendingTickets = await this.prisma.ticket.findMany({
      where: {
        area: ticket.area,
        status: TicketStatus.PENDING,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
      },
    });

    const index = pendingTickets.findIndex((t) => t.id === ticket.id);

    return {
      ticketId: ticket.id,
      area: ticket.area,
      status: ticket.status,
      queuePosition: index >= 0 ? index + 1 : 0,
      waitingBefore: index >= 0 ? index : 0,
      totalPendingInArea: pendingTickets.length,
      canChat: false,
    };
  }

  // ============================================================
  // 1) CREAR TICKET (CLIENTE) SIN ARCHIVOS
  // ============================================================
  async create(data: any, userId: number) {
    const subject: string | undefined = data.subject?.trim();
    const description: string | undefined = data.description?.trim();

    const area: string | null =
      typeof data.area === 'string' ? data.area.trim() : null;

    if (!subject || !description) {
      throw new BadRequestException('Debes enviar subject y description');
    }
    if (!area) {
      throw new BadRequestException('Debes seleccionar un área válida');
    }

    const now = new Date();

    const ticket = await this.prisma.ticket.create({
      data: {
        subject,
        description,
        area,
        createdById: userId,
        // ✅ actividad inicial
        lastActivityAt: now,
      },
      select: {
        id: true,
        subject: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        area: true,
        assignedToId: true,
      },
    });

    await this.prisma.ticketMessage.create({
      data: { content: description, ticketId: ticket.id, senderId: userId },
    });

    // ✅ EMAIL NUEVO TICKET
    await this.notifyTicketCreated({
      ticketId: ticket.id,
      subject: ticket.subject,
      area: ticket.area ?? null,
      createdById: userId,
      assignedToId: ticket.assignedToId ?? null,
    });

    const queue = await this.getQueueStatus(ticket.id);

    return {
      ...ticket,
      queue,
    };
  }

  // ============================================================
  // 1B) CREAR TICKET CON ADJUNTOS (múltiples)
  // ============================================================
  async createWithAttachments(
    data: any,
    userId: number,
    files: Array<{
      originalName: string;
      filename: string;
      mimeType: string;
      size: number;
      path: string;
    }>,
  ) {
    const subject: string | undefined = data.subject?.trim();
    const description: string | undefined = data.description?.trim();
    const area: string | null =
      typeof data.area === 'string' ? data.area.trim() : null;

    if (!subject || !description) {
      throw new BadRequestException('Debes enviar subject y description');
    }
    if (!area) {
      throw new BadRequestException('Debes seleccionar un área válida');
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          subject,
          description,
          area,
          createdById: userId,
          // ✅ actividad inicial
          lastActivityAt: now,
        },
        select: {
          id: true,
          subject: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          area: true,
          assignedToId: true,
        },
      });

      const msg = await tx.ticketMessage.create({
        data: { content: description, ticketId: ticket.id, senderId: userId },
      });

      if (files?.length) {
        await tx.ticketAttachment.createMany({
          data: files.map((f) => ({
            ticketId: ticket.id,
            messageId: msg.id,
            originalName: f.originalName,
            filename: f.filename,
            mimeType: f.mimeType,
            size: f.size,
            path: f.path,
          })),
        });
      }

      return ticket;
    });

    // ✅ EMAIL NUEVO TICKET
    await this.notifyTicketCreated({
      ticketId: result.id,
      subject: result.subject,
      area: result.area ?? null,
      createdById: userId,
      assignedToId: result.assignedToId ?? null,
    });

    const queue = await this.getQueueStatus(result.id);

    return {
      ...result,
      queue,
    };
  }

  // ============================================================
  // 2) VER MIS TICKETS (CLIENTE)
  // ============================================================
  async findMy(userId: number) {
    const rows = await this.prisma.ticket.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subject: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        area: true,
        assignedToId: true,
        assignedTo: { select: { name: true } },
      },
    });

    return rows.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      area: t.area,
      assignedToId: t.assignedToId,
      assignedToName: t.assignedTo?.name ?? null,
    }));
  }

  // ============================================================
  // 4) VER TICKET INDIVIDUAL (✅ Opción A: incluye satisfaction)
  // ============================================================
  async findOne(ticketId: number) {
    const t = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        createdBy: {
          select: { name: true, email: true, cargo: true, clientArea: true },
        },
        assignedTo: { select: { name: true, email: true } },
        attachments: true,

        // ✅ CLAVE: para el modal (Opción A)
        satisfaction: true,
      },
    });

    if (!t) throw new NotFoundException('Ticket no encontrado');
    return t;
  }

  // ============================================================
  // 5) CAMBIAR ESTADO (support solo si es SU ticket)
  // ============================================================
  async updateStatus(
    ticketId: number,
    status: TicketStatus,
    user: CurrentUser,
    note?: string,
  ) {
    const t = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!t) throw new NotFoundException('Ticket no encontrado');

    if (!this.isAdmin(user) && !this.isSupport(user)) {
      throw new ForbiddenException('No autorizado');
    }

    if (this.isSupport(user)) {
      if (t.assignedToId !== user.id) {
        throw new ForbiddenException(
          'Solo puedes cambiar el estado si el ticket está asignado a ti',
        );
      }
    }

    const now = new Date();

    const dataToUpdate: any = {
      status,
      lastActivityAt: now,
    };

    if (status === TicketStatus.IN_PROGRESS && !t.assignedAt) {
      dataToUpdate.assignedAt = now;
    }

    if (status === TicketStatus.RESOLVED && !t.resolvedAt) {
      dataToUpdate.resolvedAt = now;
    }

    if (status === TicketStatus.CLOSED && !t.closedAt) {
      dataToUpdate.closedAt = now;
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: dataToUpdate,
    });

    if (status === TicketStatus.CLOSED) {
      await this.notifyTicketClosed({
        ticketId,
        closedByUserId: user.id,
      });
    }

    return updated;
  }

  // ============================================================
  // 8) MENSAJE TEXTO + activity
  // ============================================================
  async addMessage(data: {
    ticketId: number;
    content: string;
    senderId: number;
  }) {
    const { ticketId, content, senderId } = data;
    if (!content?.trim()) throw new BadRequestException('Mensaje vacío');

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        status: true,
        createdById: true,
        assignedToId: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }

    const isClient = ticket.createdById === senderId;

    if (isClient && ticket.status !== TicketStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Tu ticket sigue en fila de atención. Aún no puedes escribir.',
      );
    }

    const now = new Date();

    const msg = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticketMessage.create({
        data: { content: content.trim(), ticketId, senderId },
      });

      // ✅ actividad del chat
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          updatedAt: now,
          lastActivityAt: now,
        },
      });

      return tx.ticketMessage.findUnique({
        where: { id: created.id },
        include: {
          sender: { select: { id: true, name: true } },
          attachments: true,
        },
      });
    });

    return msg;
  }

  // ============================================================
  // 8B) MENSAJE + ARCHIVO (opcional) + activity
  // ============================================================
  async addMessageWithAttachment(params: {
    ticketId: number;
    content?: string;
    senderId: number;
    file?: {
      originalName: string;
      filename: string;
      mimeType: string;
      size: number;
      path: string;
    };
  }) {
    const { ticketId, content, senderId, file } = params;

    if (!content?.trim() && !file) {
      throw new BadRequestException(
        'Debes enviar contenido o adjuntar un archivo',
      );
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        status: true,
        createdById: true,
        assignedToId: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }

    const isClient = ticket.createdById === senderId;

    if (isClient && ticket.status !== TicketStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Tu ticket sigue en fila de atención. Aún no puedes escribir.',
      );
    }

    const now = new Date();

    const msg = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticketMessage.create({
        data: { content: content?.trim() || '', ticketId, senderId },
      });

      if (file) {
        await tx.ticketAttachment.create({
          data: {
            ticketId,
            messageId: created.id,
            originalName: file.originalName,
            filename: file.filename,
            mimeType: file.mimeType,
            size: file.size,
            path: file.path,
          },
        });
      }

      // ✅ actividad del chat
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          updatedAt: now,
          lastActivityAt: now,
        },
      });

      return tx.ticketMessage.findUnique({
        where: { id: created.id },
        include: {
          sender: { select: { id: true, name: true } },
          attachments: true,
        },
      });
    });

    return msg;
  }

  // ============================================================
  // 9) LISTAR MENSAJES + attachments
  // ============================================================
  async getMessages(ticketId: number) {
    return this.prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true } },
        attachments: true,
      },
    });
  }

  // ============================================================
  // 10) LISTA PANEL (admin/super/support)
  // ============================================================
  async getTicketsForPanel(currentUser?: CurrentUser) {
    if (!currentUser) return [];

    const roles = currentUser.roles || [];
    const isSuper = roles.includes('super-admin');
    const isAdm = roles.includes('admin');
    const isSup = roles.includes('support');

    const dbUser = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
    });

    const supportArea = dbUser?.supportArea ?? null;

    const where: any = {};

    if (isSuper) {
      // ve todos
    } else if (isAdm || isSup) {
      if (supportArea) where.area = supportArea;
      else where.id = -1;
    } else {
      where.id = -1;
    }

    const tickets = await this.prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { name: true, cargo: true, clientArea: true } },
        assignedTo: { select: { name: true } },
      },
    });

    return tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      closedAt: t.closedAt,
      area: t.area,
      requesterName: t.createdBy?.name ?? null,
      clientCargo: t.createdBy?.cargo ?? null,
      clientArea: t.createdBy?.clientArea ?? null,
      assignedToId: t.assignedToId ?? null,
      assignedToName: t.assignedTo?.name ?? null,
    }));
  }

  // ============================================================
  // 11) ASIGNARME (support/admin/super)
  // ============================================================
  async assignMe(ticketId: number, user: CurrentUser) {
    const t = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!t) throw new NotFoundException('Ticket no encontrado');

    if (!this.isSupport(user) && !this.isAdmin(user)) {
      throw new ForbiddenException('No autorizado');
    }

    if (t.assignedToId) return t;

    const now = new Date();

    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assignedToId: user.id,
        assignedAt: t.assignedAt ?? now,
        lastActivityAt: now,
      },
    });
  }

  // ============================================================
  // 12) ABRIR COMO AGENTE (auto-asigna + PENDING => IN_PROGRESS)
  // ============================================================
  async openForAgent(ticketId: number, user: CurrentUser) {
    const t = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!t) throw new NotFoundException('Ticket no encontrado');

    if (!this.isSupport(user) && !this.isAdmin(user)) {
      throw new ForbiddenException('No autorizado');
    }

    if (this.isSupport(user) && t.assignedToId && t.assignedToId !== user.id) {
      throw new ForbiddenException(
        'Este ticket ya está asignado a otro agente',
      );
    }

    const next: any = {};
    const now = new Date();

    if (!t.assignedToId) {
      next.assignedToId = user.id;
    }

    if (!t.assignedAt) {
      next.assignedAt = now;
    }

    if (t.status === TicketStatus.PENDING) {
      next.status = TicketStatus.IN_PROGRESS;
    }

    next.lastActivityAt = now;

    if (Object.keys(next).length === 0) return t;

    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: next,
    });
  }

  // ============================================================
  // ✅ SATISFACCIÓN (⭐ 1..5 + comentario)
  // ============================================================
  async submitSatisfaction(
    ticketId: number,
    user: { id: number; roles?: string[] },
    dto: TicketSatisfactionDto,
  ) {
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const isAdmin = roles.includes('super-admin') || roles.includes('admin');

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        status: true,
        createdById: true,
        satisfaction: { select: { id: true } },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    const isOwner = ticket.createdById === user.id;

    if (!isOwner && !isAdmin) throw new ForbiddenException('No autorizado');

    if (ticket.status !== TicketStatus.CLOSED) {
      throw new BadRequestException('Solo puedes calificar un ticket cerrado');
    }

    if (ticket.satisfaction) {
      throw new BadRequestException('Este ticket ya fue calificado');
    }

    return this.prisma.ticketSatisfaction.create({
      data: {
        ticketId,
        rating: dto.rating,
        comment: (dto.comment || '').trim() || null,
      },
      select: { id: true, rating: true, comment: true, createdAt: true },
    });
  }

  // ============================================================
  // (Opcional) Si DEJAS el endpoint GET /tickets/:id/satisfaction en el controller,
  // entonces necesitas este método también.
  // Si vas full Opción A, puedes borrarlo del controller y también este método.
  // ============================================================
  async getSatisfaction(
    ticketId: number,
    user: { id: number; roles?: string[] },
  ) {
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const isAdmin = roles.includes('super-admin') || roles.includes('admin');

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, createdById: true },
    });

    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    const isOwner = ticket.createdById === user.id;
    if (!isOwner && !isAdmin) throw new ForbiddenException('No autorizado');

    return this.prisma.ticketSatisfaction.findUnique({
      where: { ticketId },
      select: { rating: true, comment: true, createdAt: true },
    });
  }
  async getPendingTicketIdsByArea(area: string | null) {
    if (!area) return [];

    const rows = await this.prisma.ticket.findMany({
      where: {
        area,
        status: TicketStatus.PENDING,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
      },
    });

    return rows.map((r) => r.id);
  }
  /* ============================================================
   DASHBOARD OPERATIVO (admin / super-admin)
============================================================ */
  async getOperationsDashboard(currentUser: CurrentUser) {
    if (!this.isAdmin(currentUser)) {
      throw new ForbiddenException('No autorizado');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        name: true,
        supportArea: true,
      },
    });

    const isSuper = this.isSuperAdmin(currentUser);
    const scopeArea = isSuper ? null : (dbUser?.supportArea ?? null);

    if (!isSuper && !scopeArea) {
      throw new BadRequestException(
        'Tu usuario admin no tiene un área de soporte asignada.',
      );
    }

    const baseWhere = scopeArea ? { area: scopeArea } : {};

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // =========================
    // SUMMARY
    // =========================
    const [pendingCount, inProgressCount, closedTodayCount] = await Promise.all(
      [
        this.prisma.ticket.count({
          where: {
            ...baseWhere,
            status: TicketStatus.PENDING,
          },
        }),
        this.prisma.ticket.count({
          where: {
            ...baseWhere,
            status: TicketStatus.IN_PROGRESS,
          },
        }),
        this.prisma.ticket.count({
          where: {
            ...baseWhere,
            status: TicketStatus.CLOSED,
            closedAt: {
              gte: startOfToday,
            },
          },
        }),
      ],
    );

    // agentes activos = agentes con al menos un ticket en progreso
    const activeAssignments = await this.prisma.ticket.groupBy({
      by: ['assignedToId'],
      where: {
        ...baseWhere,
        status: TicketStatus.IN_PROGRESS,
        assignedToId: { not: null },
      },
      _count: {
        assignedToId: true,
      },
    });

    const activeAgentIds = activeAssignments
      .map((r) => r.assignedToId)
      .filter((v): v is number => typeof v === 'number');

    const activeAgentsCount = activeAgentIds.length;

    // =========================
    // COLA POR ÁREA
    // =========================
    const pendingByArea = await this.prisma.ticket.groupBy({
      by: ['area'],
      where: {
        status: TicketStatus.PENDING,
        ...(scopeArea ? { area: scopeArea } : {}),
      },
      _count: {
        _all: true,
      },
    });

    const inProgressByArea = await this.prisma.ticket.groupBy({
      by: ['area'],
      where: {
        status: TicketStatus.IN_PROGRESS,
        ...(scopeArea ? { area: scopeArea } : {}),
      },
      _count: {
        _all: true,
      },
    });

    const areaMap = new Map<
      string,
      { area: string; pending: number; inProgress: number }
    >();

    for (const row of pendingByArea) {
      const area = row.area || 'SIN ÁREA';
      areaMap.set(area, {
        area,
        pending: row._count._all,
        inProgress: 0,
      });
    }

    for (const row of inProgressByArea) {
      const area = row.area || 'SIN ÁREA';
      const existing = areaMap.get(area);
      if (existing) {
        existing.inProgress = row._count._all;
      } else {
        areaMap.set(area, {
          area,
          pending: 0,
          inProgress: row._count._all,
        });
      }
    }

    const queuesByArea = Array.from(areaMap.values()).sort((a, b) => {
      if (b.pending !== a.pending) return b.pending - a.pending;
      return a.area.localeCompare(b.area);
    });

    // =========================
    // TICKETS EN FILA
    // =========================
    const pendingTicketsRaw = await this.prisma.ticket.findMany({
      where: {
        ...baseWhere,
        status: TicketStatus.PENDING,
      },
      orderBy: [{ area: 'asc' }, { createdAt: 'asc' }],
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    const queueCounterByArea = new Map<string, number>();

    const pendingTickets = pendingTicketsRaw.map((t) => {
      const area = t.area || 'SIN ÁREA';
      const current = (queueCounterByArea.get(area) ?? 0) + 1;
      queueCounterByArea.set(area, current);

      return {
        id: t.id,
        subject: t.subject,
        requesterName: t.createdBy?.name ?? 'Sin nombre',
        requesterEmail: t.createdBy?.email ?? null,
        area: t.area,
        queuePosition: current,
        createdAt: t.createdAt,
        waitMinutes: Math.max(
          0,
          Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 60000),
        ),
      };
    });

    // =========================
    // TICKETS EN PROGRESO
    // =========================
    const inProgressTickets = await this.prisma.ticket.findMany({
      where: {
        ...baseWhere,
        status: TicketStatus.IN_PROGRESS,
      },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            supportArea: true,
          },
        },
      },
    });

    // =========================
    // TICKETS CERRADOS RECIENTES + CALIFICACIÓN
    // =========================
    const closedTickets = await this.prisma.ticket.findMany({
      where: {
        ...baseWhere,
        status: TicketStatus.CLOSED,
      },
      orderBy: [{ closedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 20,
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            supportArea: true,
          },
        },
        satisfaction: {
          select: {
            rating: true,
            comment: true,
            createdAt: true,
          },
        },
      },
    });

    // =========================
    // AGENTES DEL ALCANCE
    // =========================
    const agents = await this.prisma.user.findMany({
      where: {
        ...(scopeArea ? { supportArea: scopeArea } : {}),
        isActive: true,
        roles: {
          some: {
            role: {
              name: {
                in: ['support', 'admin', 'super-admin'],
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        supportArea: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    const activeTicketsByAgent = await this.prisma.ticket.groupBy({
      by: ['assignedToId'],
      where: {
        ...(scopeArea ? { area: scopeArea } : {}),
        status: TicketStatus.IN_PROGRESS,
        assignedToId: { not: null },
      },
      _count: {
        _all: true,
      },
    });

    const activeByAgentMap = new Map<number, number>();
    for (const row of activeTicketsByAgent) {
      if (row.assignedToId) {
        activeByAgentMap.set(row.assignedToId, row._count._all);
      }
    }

    const agentsWithStatus = agents.map((a) => {
      const activeTickets = activeByAgentMap.get(a.id) ?? 0;

      return {
        id: a.id,
        name: a.name,
        email: a.email,
        area: a.supportArea,
        roles: a.roles.map((r) => r.role.name),
        activeTickets,
        statusLabel: activeTickets > 0 ? 'ATENDIENDO' : 'LIBRE',
      };
    });

    return {
      scope: isSuper ? 'GLOBAL' : 'AREA',
      area: scopeArea,
      summary: {
        pending: pendingCount,
        inProgress: inProgressCount,
        closedToday: closedTodayCount,
        activeAgents: activeAgentsCount,
      },
      queuesByArea,
      pendingTickets,
      inProgressTickets: inProgressTickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        requesterName: t.createdBy?.name ?? 'Sin nombre',
        requesterEmail: t.createdBy?.email ?? null,
        assignedToId: t.assignedTo?.id ?? null,
        assignedToName: t.assignedTo?.name ?? 'Sin asignar',
        area: t.area,
        updatedAt: t.updatedAt,
        createdAt: t.createdAt,
        attentionMinutes: t.assignedAt
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(t.assignedAt).getTime()) / 60000,
              ),
            )
          : 0,
      })),
      closedTickets: closedTickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        requesterName: t.createdBy?.name ?? 'Sin nombre',
        requesterEmail: t.createdBy?.email ?? null,
        assignedToName: t.assignedTo?.name ?? 'Sin asignar',
        area: t.area,
        closedAt: t.closedAt,
        satisfaction: t.satisfaction
          ? {
              rating: t.satisfaction.rating,
              comment: t.satisfaction.comment,
              createdAt: t.satisfaction.createdAt,
            }
          : null,
      })),
      agents: agentsWithStatus,
    };
  }
}
