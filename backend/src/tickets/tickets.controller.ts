// src/tickets/tickets.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TicketsService } from './tickets.service';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // Crear ticket
  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.ticketsService.create(body, req.user.id);
  }

  // Ver mis tickets
  @Get('my')
  findMy(@Req() req: any) {
    return this.ticketsService.findMy(req.user.id);
  }

  // Ver todos los tickets (admin o soporte)
  @Get()
  @UseGuards(RolesGuard)
  @Roles('support', 'admin')
  findAll() {
    return this.ticketsService.findAll();
  }

  // Ver un ticket (admin, soporte o dueño)
  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const ticket = await this.ticketsService.findOne(Number(id));

    if (!ticket) {
      return { message: 'Ticket no existe' };
    }

    const isAdminOrSupport =
      req.user.roles.includes('admin') || req.user.roles.includes('support');
    const isOwner = ticket.createdById === req.user.id; // 👈 aquí el cambio

    if (!isAdminOrSupport && !isOwner) {
      return { message: 'No autorizado' };
    }

    return ticket;
  }

  // Cambiar estado
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('support', 'admin')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: any,
  ) {
    return this.ticketsService.updateStatus(
      Number(id),
      dto.status,
      req.user.id,
      dto.note,
    );
  }

  // Asignar ticket
  @Patch(':id/assign')
  @UseGuards(RolesGuard)
  @Roles('support', 'admin')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
    @Req() req: any,
  ) {
    return this.ticketsService.assignTicket(
      Number(id),
      dto.assignedToId,
      req.user.id,
      dto.note,
    );
  }

  // Historial
  @Get(':id/history')
  @UseGuards(RolesGuard)
  @Roles('support', 'admin', 'auditor')
  getHistory(@Param('id') id: string) {
    return this.ticketsService.getHistory(Number(id));
  }
}
