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
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('tickets')
@UseGuards(JwtAuthGuard) // todos requieren JWT
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // ================== TICKETS BÁSICOS ==================

  // Crear ticket
  @Post()
  create(@Body() body: any, @Req() req: any) {
    // tu servicio se llama "create"
    return this.ticketsService.create(body, req.user.id);
  }

  // Ver mis tickets
  @Get('my')
  findMy(@Req() req: any) {
    // tu servicio se llama "findMy"
    return this.ticketsService.findMy(req.user.id);
  }

  // Ver todos los tickets (admin o soporte)
  @Get('list')
  @UseGuards(RolesGuard)
  @Roles('support', 'admin')
  findAll() {
    // tu servicio se llama "findAll"
    return this.ticketsService.findAll();
  }

  // Lista simplificada para el panel (ya existe en tu servicio)
  @Get('panel-list')
  @UseGuards(RolesGuard)
  @Roles('support', 'admin')
  async panelList(@Req() req: any) {
    return this.ticketsService.getTicketsForPanel({
      id: req.user.id,
      roles: req.user.roles || [],
    });
  }

  // Ver un ticket concreto
  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const ticketId = Number(id);
    const ticket = await this.ticketsService.findOne(ticketId);

    if (!ticket) {
      return { message: 'Ticket no existe' };
    }

    const isAdminOrSupport =
      req.user.roles?.includes('admin') || req.user.roles?.includes('support');
    const isOwner = ticket.createdById === req.user.id;
    const isAssigned = ticket.assignedToId === req.user.id;

    if (!isAdminOrSupport && !isOwner && !isAssigned) {
      return { message: 'No autorizado' };
    }

    return ticket;
  }

  // ================== CAMBIAR ESTADO ==================

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('support', 'admin')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: any,
  ) {
    const ticketId = Number(id);
    // tu servicio se llama "updateStatus"
    return this.ticketsService.updateStatus(
      ticketId,
      dto.status,
      req.user.id,
      dto.note,
    );
  }

  // ================== ASIGNAR TICKET ==================

  @Patch(':id/assign')
  @UseGuards(RolesGuard)
  @Roles('support', 'admin')
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
    @Req() req: any,
  ) {
    const ticketId = Number(id);
    // tu servicio se llama "assignTicket"
    return this.ticketsService.assignTicket(
      ticketId,
      dto.assignedToId,
      req.user.id,
      dto.note,
    );
  }

  // ================== HISTORIAL ==================

  @Get(':id/history')
  @UseGuards(RolesGuard)
  @Roles('support', 'admin', 'auditor')
  getHistory(@Param('id') id: string) {
    const ticketId = Number(id);
    // tu servicio se llama "getHistory"
    return this.ticketsService.getHistory(ticketId);
  }

  // ================== CHAT INTERNO ==================

  // Enviar mensaje al chat del ticket
  @Post(':id/messages')
  async addMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @Req() req: any,
  ) {
    const ticketId = Number(id);
    const ticket = await this.ticketsService.findOne(ticketId);

    if (!ticket) {
      return { message: 'Ticket no existe' };
    }

    const isAdminOrSupport =
      req.user.roles?.includes('admin') || req.user.roles?.includes('support');
    const isOwner = ticket.createdById === req.user.id;
    const isAssigned = ticket.assignedToId === req.user.id;

    if (!isAdminOrSupport && !isOwner && !isAssigned) {
      return {
        message: 'No autorizado para escribir en este ticket',
      };
    }

    // tu servicio tiene firma: addMessage({ ticketId, content, senderId })
    return this.ticketsService.addMessage({
      ticketId,
      senderId: req.user.id,
      content: dto.content,
    });
  }

  // Listar mensajes del chat del ticket
  @Get(':id/messages')
  async getMessages(@Param('id') id: string, @Req() req: any) {
    const ticketId = Number(id);
    const ticket = await this.ticketsService.findOne(ticketId);

    if (!ticket) {
      return { message: 'Ticket no existe' };
    }

    const isAdminOrSupport =
      req.user.roles?.includes('admin') || req.user.roles?.includes('support');
    const isOwner = ticket.createdById === req.user.id;
    const isAssigned = ticket.assignedToId === req.user.id;

    if (!isAdminOrSupport && !isOwner && !isAssigned) {
      return { message: 'No autorizado para ver este chat' };
    }

    // tu servicio se llama "getMessages"
    return this.ticketsService.getMessages(ticketId);
  }
}
