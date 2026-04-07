import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsGateway } from './tickets.gateway';

@Injectable()
export class TicketsAutoCloseService {
  private readonly logger = new Logger(TicketsAutoCloseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: TicketsGateway, // para notificar por WS
  ) {}

  // Corre cada 2 minutos (ajústalo a gusto)
  @Cron('*/2 * * * *')
  async autoCloseResolvedTickets() {
    const limitMs = 3 * 60 * 60 * 1000; // 3 horas
    const cutoff = new Date(Date.now() - limitMs);

    // Tickets RESOLVED sin actividad en 3h
    const candidates = await this.prisma.ticket.findMany({
      where: {
        status: 'RESOLVED',
        lastActivityAt: { lte: cutoff },
      },
      select: { id: true },
      take: 200,
    });

    if (!candidates.length) return;

    for (const t of candidates) {
      // Re-validación atómica: evita cerrar si cambió justo ahora
      const updated = await this.prisma.ticket.updateMany({
        where: {
          id: t.id,
          status: 'RESOLVED',
          lastActivityAt: { lte: cutoff },
        },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          lastActivityAt: new Date(),
        },
      });

      if (updated.count > 0) {
        this.logger.log(`Auto-cerrado Ticket #${t.id} por inactividad (3h).`);

        // Notificar a los clientes conectados a ese ticket
        // this.gateway.emitTicketStatusChanged(t.id, 'CLOSED');
      }
    }
  }
}
