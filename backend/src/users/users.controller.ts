// src/users/users.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ============================================================
  // 🔹 AGENTES / ADMINS
  // ============================================================

  // Listar agentes y admins
  @Get('agents')
  @Roles('admin', 'super-admin')
  listAgents() {
    return this.usersService.listAgentsAndAdmins();
  }

  // Crear agente / admin / super-admin
  @Post('agents')
  @Roles('admin', 'super-admin')
  createAgent(@Body() dto: CreateAgentDto) {
    return this.usersService.createAgent(dto);
  }

  // Actualizar agente / admin / super-admin
  @Patch('agents/:id')
  @Roles('admin', 'super-admin')
  updateAgent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAgentDto,
  ) {
    return this.usersService.updateAgent(id, dto);
  }

  // ✅ Eliminar agente (recomendado: soft delete / desactivar)
  @Delete('agents/:id')
  @Roles('admin', 'super-admin')
  deleteAgent(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deleteAgent(id);
  }

  // ============================================================
  // 🔹 CLIENTES (usuarios finales)
  // ============================================================

  // Listar clientes
  @Get('clients')
  @Roles('super-admin')
  listClients() {
    return this.usersService.listClients();
  }

  // Crear cliente
  @Post('clients')
  @Roles('super-admin')
  createClient(@Body() dto: CreateClientDto) {
    return this.usersService.createClient(dto);
  }

  // Actualizar cliente
  @Patch('clients/:id')
  @Roles('super-admin')
  updateClient(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
  ) {
    return this.usersService.updateClient(id, dto);
  }

  // (Opcional) ✅ Eliminar cliente (soft delete / desactivar)
  @Delete('clients/:id')
  @Roles('super-admin')
  deleteClient(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deleteClient(id);
  }
}
