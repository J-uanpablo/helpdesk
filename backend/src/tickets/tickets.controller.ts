import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TicketsService } from './tickets.service';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // 🟢 Usuario crea ticket
  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.ticketsService.create(body, req.user.id);
  }

  // 🟢 Usuario ve solo sus tickets
  @Get('my')
  findMy(@Req() req: any) {
    return this.ticketsService.findMy(req.user.id);
  }

  // 🔥 Solo soporte o admin ven todo
  @Get()
  @UseGuards(RolesGuard)
  @Roles('support', 'admin')
  findAll() {
    return this.ticketsService.findAll();
  }

  // 🔥 Ver ticket por ID (admin, soporte o dueño)
  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const ticket = await this.ticketsService.findOne(Number(id));
    if (!ticket) return { message: 'Ticket no existe' };

    if (
      req.user.roles.includes('admin') ||
      req.user.roles.includes('support') ||
      ticket.userId === req.user.id
    ) {
      return ticket;
    }

    return { message: 'No autorizado' };
  }
}
