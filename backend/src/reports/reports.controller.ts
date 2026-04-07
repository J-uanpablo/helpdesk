import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import ExcelJS from 'exceljs';

type CurrentUser = { id: number; roles?: string[] };

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  private getCurrentUser(req: Request): CurrentUser {
    const u: any = (req as any).user;
    return { id: Number(u?.id), roles: Array.isArray(u?.roles) ? u.roles : [] };
  }

  private isAdmin(user: CurrentUser) {
    const r = user.roles || [];
    return r.includes('admin') || r.includes('super-admin');
  }

  private isSuperAdmin(user: CurrentUser) {
    return (user.roles || []).includes('super-admin');
  }

  // Normaliza strings
  private norm(v?: string | null) {
    return String(v ?? '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  // ✅ MAPA DE ESTADOS EN ESPAÑOL
  private readonly STATUS_ES: Record<string, string> = {
    CLOSED: 'CERRADO',
    IN_PROGRESS: 'EN PROGRESO',
    RESOLVED: 'RESUELTO',
  };

  @Get('support-performance.xlsx')
  async supportPerformanceXlsx(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('area') area: string | undefined,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const user = this.getCurrentUser(req);

    if (!this.isAdmin(user)) {
      throw new BadRequestException('No autorizado');
    }

    if (!from || !to) {
      throw new BadRequestException('Debes enviar from y to (YYYY-MM-DD)');
    }

    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Fechas inválidas. Usa YYYY-MM-DD');
    }

    if (fromDate > toDate) {
      throw new BadRequestException('from no puede ser mayor que to');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { supportArea: true, roles: true, name: true },
    });

    const isSuper = this.isSuperAdmin(user);

    const areaToReport = isSuper
      ? this.norm(area) || null
      : this.norm(dbUser?.supportArea) || null;

    if (!areaToReport && !isSuper) {
      throw new BadRequestException(
        'Este admin no tiene supportArea definida.',
      );
    }

    // ✅ AGENTES
    const agents = areaToReport
      ? await this.prisma.user.findMany({
          where: { supportArea: areaToReport },
          select: { id: true, name: true, email: true, supportArea: true },
          orderBy: { name: 'asc' },
        })
      : [];

    // ✅ TICKETS (incluye satisfacción)
    const tickets = await this.prisma.ticket.findMany({
      where: {
        ...(areaToReport ? { area: areaToReport } : {}),
        status: { in: ['RESOLVED', 'IN_PROGRESS', 'CLOSED'] },
        updatedAt: { gte: fromDate, lte: toDate },
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, supportArea: true },
        },
        createdBy: { select: { name: true, email: true } },
        satisfaction: true, // ✅ NUEVO
      },
      orderBy: { updatedAt: 'desc' },
    });

    // =======================
    // EXCEL
    // =======================
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Helpdesk';
    wb.created = new Date();

    // =======================
    // RESUMEN
    // =======================
    const wsSummary = wb.addWorksheet('Resumen por agente');
    wsSummary.columns = [
      { header: 'Agente', key: 'agent', width: 30 },
      { header: 'Área', key: 'area', width: 20 },
      { header: 'Tickets', key: 'count', width: 12 },
      { header: 'Cerrados', key: 'closed', width: 12 },
      { header: 'En Progreso', key: 'inProgress', width: 14 },
      { header: 'Resueltos', key: 'resolved', width: 12 },
      { header: 'Calificados', key: 'ratedCount', width: 12 }, // ✅ NUEVO
      { header: 'Promedio ⭐', key: 'avgRating', width: 12 }, // ✅ NUEVO
    ];

    const stats = new Map<
      number,
      {
        agent: string;
        area: string;
        count: number;
        closed: number;
        inProgress: number;
        resolved: number;
        ratedCount: number;
        ratingSum: number;
      }
    >();

    for (const a of agents) {
      stats.set(a.id, {
        agent: a.name || 'Agente',
        area: a.supportArea || '',
        count: 0,
        closed: 0,
        inProgress: 0,
        resolved: 0,
        ratedCount: 0,
        ratingSum: 0,
      });
    }

    const UNASSIGNED_ID = 0;
    stats.set(UNASSIGNED_ID, {
      agent: 'SIN ASIGNAR',
      area: areaToReport ?? '',
      count: 0,
      closed: 0,
      inProgress: 0,
      resolved: 0,
      ratedCount: 0,
      ratingSum: 0,
    });

    for (const t of tickets) {
      const agentId = t.assignedToId ?? UNASSIGNED_ID;
      const agentName = t.assignedTo?.name ?? 'SIN ASIGNAR';
      const agentArea = t.assignedTo?.supportArea ?? areaToReport ?? '';

      if (!stats.has(agentId)) {
        stats.set(agentId, {
          agent: agentName,
          area: agentArea,
          count: 0,
          closed: 0,
          inProgress: 0,
          resolved: 0,
          ratedCount: 0,
          ratingSum: 0,
        });
      }

      const s = stats.get(agentId)!;
      s.count += 1;
      if (t.status === 'CLOSED') s.closed += 1;
      if (t.status === 'IN_PROGRESS') s.inProgress += 1;
      if (t.status === 'RESOLVED') s.resolved += 1;

      if (t.satisfaction?.rating) {
        s.ratedCount += 1;
        s.ratingSum += t.satisfaction.rating;
      }
    }

    wsSummary.addRows(
      Array.from(stats.values())
        .map((s) => ({
          agent: s.agent,
          area: s.area,
          count: s.count,
          closed: s.closed,
          inProgress: s.inProgress,
          resolved: s.resolved,
          ratedCount: s.ratedCount,
          avgRating:
            s.ratedCount > 0
              ? Number((s.ratingSum / s.ratedCount).toFixed(2))
              : '',
        }))
        .sort(
          (a, b) =>
            (b.count as number) - (a.count as number) ||
            String(a.agent).localeCompare(String(b.agent), 'es-CO', {
              sensitivity: 'base',
            }),
        ),
    );

    // =======================
    // DETALLE
    // =======================
    const wsDetail = wb.addWorksheet('Detalle');
    wsDetail.columns = [
      { header: 'Ticket ID', key: 'id', width: 10 },
      { header: 'Asunto', key: 'subject', width: 40 },
      { header: 'Área', key: 'area', width: 20 },
      { header: 'Estado', key: 'status', width: 14 },
      { header: 'Cliente', key: 'client', width: 25 },
      { header: 'Agente', key: 'agent', width: 25 },
      { header: 'Creado', key: 'createdAt', width: 20 },
      { header: 'Actualizado/Cierre', key: 'updatedAt', width: 20 },

      // ✅ NUEVO: satisfacción
      { header: 'Satisfacción (1-5)', key: 'rating', width: 18 },
      { header: 'Comentario satisfacción', key: 'ratingComment', width: 40 },
      { header: 'Fecha satisfacción', key: 'ratingDate', width: 20 },
    ];

    const fmt = (d?: Date) =>
      d ? d.toISOString().replace('T', ' ').slice(0, 16) : '';

    wsDetail.addRows(
      tickets.map((t) => ({
        id: t.id,
        subject: t.subject ?? '',
        area: t.area ?? '',
        status: this.STATUS_ES[t.status] ?? t.status,
        client: t.createdBy?.name ?? '',
        agent: t.assignedTo?.name ?? 'SIN ASIGNAR',
        createdAt: fmt(t.createdAt),
        updatedAt: fmt(t.updatedAt),

        rating: t.satisfaction?.rating ?? '',
        ratingComment: t.satisfaction?.comment ?? '',
        ratingDate: t.satisfaction?.createdAt
          ? fmt(t.satisfaction.createdAt)
          : '',
      })),
    );

    // estilos
    [wsSummary, wsDetail].forEach((ws) => {
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: 'frozen', ySplit: 1 } as any];
    });

    const safeArea = areaToReport
      ? areaToReport.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')
      : 'todas';

    const filename = `reporte_soporte_${safeArea}_${from}_a_${to}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  }
}
