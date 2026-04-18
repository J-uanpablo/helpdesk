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
import { TicketStatus } from '@prisma/client';

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

  private norm(v?: string | null) {
    return String(v ?? '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private readonly STATUS_ES: Record<string, string> = {
    PENDING: 'EN FILA',
    CLOSED: 'CERRADO',
    IN_PROGRESS: 'EN PROGRESO',
    RESOLVED: 'RESUELTO',
  };

  private diffMinutes(start?: Date | null, end?: Date | null) {
    if (!start || !end) return null;
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  }

  private formatDuration(minutes?: number | null) {
    if (minutes == null) return '';

    const days = Math.floor(minutes / 1440); // 1440 min = 1 día
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;

    if (days > 0) {
      return `${days} d ${hours} h`;
    }

    if (hours > 0) {
      return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
    }

    return `${mins} min`;
  }

  private fmtDate(d?: Date | null) {
    if (!d) return '';

    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);

    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? '';

    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
  }

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

    const now = new Date();

    // =======================
    // AGENTES
    // =======================
    const agents = areaToReport
      ? await this.prisma.user.findMany({
          where: { supportArea: areaToReport },
          select: { id: true, name: true, email: true, supportArea: true },
          orderBy: { name: 'asc' },
        })
      : await this.prisma.user.findMany({
          select: { id: true, name: true, email: true, supportArea: true },
          orderBy: [{ supportArea: 'asc' }, { name: 'asc' }],
        });

    // =======================
    // TICKETS DEL REPORTE
    // =======================
    const tickets = await this.prisma.ticket.findMany({
      where: {
        ...(areaToReport ? { area: areaToReport } : {}),
        status: {
          in: [
            TicketStatus.RESOLVED,
            TicketStatus.IN_PROGRESS,
            TicketStatus.CLOSED,
          ],
        },
        updatedAt: { gte: fromDate, lte: toDate },
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, supportArea: true },
        },
        createdBy: { select: { name: true, email: true } },
        satisfaction: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // =======================
    // TICKETS EN FILA ACTUALES
    // =======================
    const pendingTickets = await this.prisma.ticket.findMany({
      where: {
        ...(areaToReport ? { area: areaToReport } : {}),
        status: TicketStatus.PENDING,
        createdAt: { lte: toDate },
      },
      include: {
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: [{ area: 'asc' }, { createdAt: 'asc' }],
    });

    // =======================
    // MÉTRICAS GLOBALES
    // =======================
    const totalTickets = tickets.length;
    const totalPending = pendingTickets.length;
    const totalInProgress = tickets.filter(
      (t) => t.status === TicketStatus.IN_PROGRESS,
    ).length;
    const totalClosed = tickets.filter(
      (t) => t.status === TicketStatus.CLOSED,
    ).length;
    const totalResolved = tickets.filter(
      (t) => t.status === TicketStatus.RESOLVED,
    ).length;
    const totalUnassigned = tickets.filter((t) => !t.assignedToId).length;

    const assignmentMinutesList = tickets
      .map((t) => this.diffMinutes(t.createdAt, t.assignedAt))
      .filter((v): v is number => v != null);

    const pendingWaitMinutesList = pendingTickets
      .map((t) => this.diffMinutes(t.createdAt, now))
      .filter((v): v is number => v != null);

    const totalRated = tickets.filter((t) => !!t.satisfaction?.rating).length;
    const avgRating =
      totalRated > 0
        ? Number(
            (
              tickets.reduce(
                (acc, t) => acc + (t.satisfaction?.rating ?? 0),
                0,
              ) / totalRated
            ).toFixed(2),
          )
        : '';

    const avgAssignmentMinutes =
      assignmentMinutesList.length > 0
        ? Math.round(
            assignmentMinutesList.reduce((acc, v) => acc + v, 0) /
              assignmentMinutesList.length,
          )
        : null;

    const maxAssignmentMinutes =
      assignmentMinutesList.length > 0
        ? Math.max(...assignmentMinutesList)
        : null;

    const avgPendingWaitMinutes =
      pendingWaitMinutesList.length > 0
        ? Math.round(
            pendingWaitMinutesList.reduce((acc, v) => acc + v, 0) /
              pendingWaitMinutesList.length,
          )
        : null;

    const maxPendingWaitMinutes =
      pendingWaitMinutesList.length > 0
        ? Math.max(...pendingWaitMinutesList)
        : null;

    // =======================
    // EXCEL
    // =======================
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Helpdesk';
    wb.created = new Date();

    // =======================
    // HOJA 1: RESUMEN EJECUTIVO
    // =======================
    const wsExecutive = wb.addWorksheet('Resumen Ejecutivo');
    wsExecutive.columns = [
      { header: 'Indicador', key: 'indicator', width: 38 },
      { header: 'Valor', key: 'value', width: 24 },
    ];

    wsExecutive.addRows([
      { indicator: 'Rango consultado', value: `${from} a ${to}` },
      { indicator: 'Área', value: areaToReport ?? 'Todas' },
      { indicator: 'Total tickets del reporte', value: totalTickets },
      { indicator: 'Tickets en fila', value: totalPending },
      { indicator: 'Tickets en progreso', value: totalInProgress },
      { indicator: 'Tickets cerrados', value: totalClosed },
      { indicator: 'Tickets resueltos', value: totalResolved },
      { indicator: 'Tickets sin asignar', value: totalUnassigned },
      {
        indicator: 'Promedio tiempo hasta asignación',
        value: this.formatDuration(avgAssignmentMinutes),
      },
      {
        indicator: 'Mayor tiempo hasta asignación',
        value: this.formatDuration(maxAssignmentMinutes),
      },
      {
        indicator: 'Promedio tiempo en fila',
        value: this.formatDuration(avgPendingWaitMinutes),
      },
      {
        indicator: 'Mayor tiempo en fila',
        value: this.formatDuration(maxPendingWaitMinutes),
      },
      { indicator: 'Tickets calificados', value: totalRated },
      {
        indicator: 'Promedio satisfacción',
        value: avgRating === '' ? '' : `${avgRating}/5`,
      },
    ]);

    // =======================
    // HOJA 2: TICKETS EN FILA
    // =======================
    const wsQueue = wb.addWorksheet('Tickets en fila');
    wsQueue.columns = [
      { header: 'Ticket ID', key: 'id', width: 10 },
      { header: 'Asunto', key: 'subject', width: 40 },
      { header: 'Área', key: 'area', width: 20 },
      { header: 'Cliente', key: 'client', width: 25 },
      { header: 'Creado', key: 'createdAt', width: 20 },
      { header: 'Minutos en fila', key: 'waitMinutes', width: 18 },
    ];

    wsQueue.addRows(
      pendingTickets.map((t) => ({
        id: t.id,
        subject: t.subject ?? '',
        area: t.area ?? '',
        client: t.createdBy?.name ?? '',
        createdAt: this.fmtDate(t.createdAt),
        waitMinutes: this.formatDuration(this.diffMinutes(t.createdAt, now)),
      })),
    );

    // =======================
    // HOJA 3: RESUMEN POR AGENTE
    // =======================
    const wsSummary = wb.addWorksheet('Resumen por agente');
    wsSummary.columns = [
      { header: 'Agente', key: 'agent', width: 30 },
      { header: 'Área', key: 'area', width: 20 },
      { header: 'Tickets', key: 'count', width: 12 },
      { header: 'Cerrados', key: 'closed', width: 12 },
      { header: 'En Progreso', key: 'inProgress', width: 14 },
      { header: 'Resueltos', key: 'resolved', width: 12 },
      { header: 'Calificados', key: 'ratedCount', width: 12 },
      { header: 'Promedio ⭐', key: 'avgRating', width: 12 },
      { header: 'Promedio asignación', key: 'avgAssign', width: 18 },
      { header: 'Mayor asignación', key: 'maxAssign', width: 18 },
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
        assignmentCount: number;
        assignmentMinutesSum: number;
        assignmentMinutesMax: number;
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
        assignmentCount: 0,
        assignmentMinutesSum: 0,
        assignmentMinutesMax: 0,
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
      assignmentCount: 0,
      assignmentMinutesSum: 0,
      assignmentMinutesMax: 0,
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
          assignmentCount: 0,
          assignmentMinutesSum: 0,
          assignmentMinutesMax: 0,
        });
      }

      const s = stats.get(agentId)!;
      s.count += 1;
      if (t.status === TicketStatus.CLOSED) s.closed += 1;
      if (t.status === TicketStatus.IN_PROGRESS) s.inProgress += 1;
      if (t.status === TicketStatus.RESOLVED) s.resolved += 1;

      if (t.satisfaction?.rating) {
        s.ratedCount += 1;
        s.ratingSum += t.satisfaction.rating;
      }

      const assignMinutes = this.diffMinutes(t.createdAt, t.assignedAt);
      if (assignMinutes != null) {
        s.assignmentCount += 1;
        s.assignmentMinutesSum += assignMinutes;
        s.assignmentMinutesMax = Math.max(
          s.assignmentMinutesMax,
          assignMinutes,
        );
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
          avgAssign:
            s.assignmentCount > 0
              ? this.formatDuration(
                  Math.round(s.assignmentMinutesSum / s.assignmentCount),
                )
              : '',
          maxAssign:
            s.assignmentCount > 0
              ? this.formatDuration(s.assignmentMinutesMax)
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
    // HOJA 4: DETALLE
    // =======================
    const wsDetail = wb.addWorksheet('Detalle');
    wsDetail.columns = [
      { header: 'Ticket ID', key: 'id', width: 10 },
      { header: 'Asunto', key: 'subject', width: 40 },
      { header: 'Área', key: 'area', width: 20 },
      { header: 'Estado', key: 'status', width: 16 },
      { header: 'Cliente', key: 'client', width: 25 },
      { header: 'Agente', key: 'agent', width: 25 },
      { header: 'Creado', key: 'createdAt', width: 20 },
      { header: 'Asignado', key: 'assignedAt', width: 20 },
      { header: 'Actualizado/Cierre', key: 'updatedAt', width: 20 },
      {
        header: 'Minutos hasta asignación',
        key: 'assignmentMinutes',
        width: 22,
      },
      { header: 'Minutos de atención', key: 'attentionMinutes', width: 20 },
      { header: 'Minutos totales', key: 'totalMinutes', width: 18 },
      { header: 'Satisfacción (1-5)', key: 'rating', width: 18 },
      { header: 'Comentario satisfacción', key: 'ratingComment', width: 40 },
      { header: 'Fecha satisfacción', key: 'ratingDate', width: 20 },
    ];

    wsDetail.addRows(
      tickets.map((t) => {
        const assignmentMinutes = this.diffMinutes(t.createdAt, t.assignedAt);

        const attentionEnd = t.closedAt ?? t.resolvedAt ?? t.updatedAt ?? null;

        const attentionMinutes = this.diffMinutes(t.assignedAt, attentionEnd);
        const totalMinutes = this.diffMinutes(t.createdAt, attentionEnd);

        return {
          id: t.id,
          subject: t.subject ?? '',
          area: t.area ?? '',
          status: this.STATUS_ES[t.status] ?? t.status,
          client: t.createdBy?.name ?? '',
          agent: t.assignedTo?.name ?? 'SIN ASIGNAR',
          createdAt: this.fmtDate(t.createdAt),
          assignedAt: this.fmtDate(t.assignedAt),
          updatedAt: this.fmtDate(attentionEnd),
          assignmentMinutes: this.formatDuration(assignmentMinutes),
          attentionMinutes: this.formatDuration(attentionMinutes),
          totalMinutes: this.formatDuration(totalMinutes),
          rating: t.satisfaction?.rating ?? '',
          ratingComment: t.satisfaction?.comment ?? '',
          ratingDate: t.satisfaction?.createdAt
            ? this.fmtDate(t.satisfaction.createdAt)
            : '',
        };
      }),
    );

    // =======================
    // ESTILOS
    // =======================
    const worksheets = [wsExecutive, wsQueue, wsSummary, wsDetail];

    worksheets.forEach((ws) => {
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '0F766E' },
      };
      ws.views = [{ state: 'frozen', ySplit: 1 } as any];

      if (ws.columnCount > 0) {
        const lastColLetter = ws.getColumn(ws.columnCount).letter;
        ws.autoFilter = {
          from: 'A1',
          to: `${lastColLetter}1`,
        };
      }
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
