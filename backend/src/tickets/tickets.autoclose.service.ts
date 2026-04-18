import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsGateway } from './tickets.gateway';

@Injectable()
export class TicketsAutoCloseService {
  private readonly logger = new Logger(TicketsAutoCloseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: TicketsGateway,
  ) {}

  /**
   * Cierra automáticamente tickets RESOLVED
   * que no tengan actividad en X horas.
   */
  @Cron('*/2 * * * *') // cada 2 minutos
  async autoCloseResolvedTickets() {
    const limitMinutes = Number(process.env.TICKET_AUTO_CLOSE_MINUTES || 180);
    const limitMs = limitMinutes * 60 * 1000;

    const cutoff = new Date(Date.now() - limitMs);
    const now = new Date();

    // Buscar tickets candidatos
    const candidates = await this.prisma.ticket.findMany({
      where: {
        status: 'RESOLVED',
        lastActivityAt: { lte: cutoff },
      },
      select: {
        id: true,
      },
      take: 200,
    });

    if (!candidates.length) return;

    for (const t of candidates) {
      try {
        // Revalidación atómica (evita condiciones de carrera)
        const updated = await this.prisma.ticket.updateMany({
          where: {
            id: t.id,
            status: 'RESOLVED',
            lastActivityAt: { lte: cutoff },
          },
          data: {
            status: 'CLOSED',
            closedAt: now,
            lastActivityAt: now,
          },
        });

        if (updated.count === 0) continue;

        this.logger.log(
          `Auto-cerrado Ticket #${t.id} por inactividad (${limitMinutes} min).`,
        );

        // =========================
        // HISTORIAL DEL TICKET
        // =========================
        try {
          await this.prisma.ticketHistory.create({
            data: {
              ticketId: t.id,
              changedById: 21, // ⚠️ Cambia este ID por uno real de tu BD
              fromStatus: 'RESOLVED',
              toStatus: 'CLOSED',
              note: `Cierre automático por inactividad de ${limitMinutes} minutos`,
            },
          });
        } catch (err) {
          this.logger.warn(
            `No se pudo registrar historial del ticket #${t.id}`,
          );
        }

        // =========================
        // WEBSOCKET
        // =========================
        try {
          this.gateway.emitTicketStatusChanged({
            ticketId: t.id,
            status: 'CLOSED',
            reason: 'AUTO_CLOSE',
            changedAt: now.toISOString(),
          });
        } catch (err) {
          this.logger.warn(`Error enviando evento WS para ticket #${t.id}`);
        }
      } catch (error) {
        this.logger.error(
          `Error al autocerrar ticket #${t.id}`,
          error instanceof Error ? error.stack : '',
        );
      }
    }
  }
}
