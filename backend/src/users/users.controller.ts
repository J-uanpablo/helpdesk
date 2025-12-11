// src/users/users.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
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

  // Crear agente / admin
  @Post('agents')
  @Roles('admin', 'super-admin')
  createAgent(@Body() dto: CreateAgentDto) {
    return this.usersService.createAgent(dto);
  }

  // Actualizar agente / admin
  @Patch('agents/:id')
  @Roles('admin', 'super-admin')
  updateAgent(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.usersService.updateAgent(Number(id), dto);
  }

  // ============================================================
  // 🔹 CLIENTES (usuarios finales)
  // ============================================================

  // Listar clientes
  @Get('clients')
  @Roles('super-admin')
  async listClients() {
    return this.usersService.listClients();
  }

  // Crear cliente
  @Post('clients')
  @Roles('super-admin')
  async createClient(@Body() dto: CreateClientDto) {
    return this.usersService.createClient(dto);
  }

  // Actualizar cliente
  @Patch('clients/:id')
  @Roles('super-admin')
  async updateClient(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.usersService.updateClient(Number(id), dto);
  }
}
