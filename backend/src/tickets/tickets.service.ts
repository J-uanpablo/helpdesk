// src/tickets/tickets.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketPriority } from '@prisma/client'; // 👈 IMPORTANTE

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: { title: string; description: string; priority?: TicketPriority },
    userId: number,
  ) {
    return this.prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority ?? TicketPriority.MEDIUM, // 👈 enum, no string suelto
        userId,
      },
    });
  }

  findMy(userId: number) {
    return this.prisma.ticket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAll() {
    return this.prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.ticket.findUnique({ where: { id } });
  }
}
