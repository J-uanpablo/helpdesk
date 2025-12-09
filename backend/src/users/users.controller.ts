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
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin') // 👈 todas estas rutas solo para admin
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // =======================
  // 🔥 LISTAR AGENTES
  // GET /users/agents
  // =======================
  @Get('agents')
  listAgents() {
    return this.usersService.listAgents();
  }

  // =======================
  // 🔥 CREAR AGENTE
  // POST /users/agents
  // =======================
  @Post('agents')
  createAgent(@Body() body: any) {
    return this.usersService.createAgent(body);
  }

  // =======================
  // 🔥 ACTUALIZAR AGENTE
  // PATCH /users/agents/:id
  // =======================
  @Patch('agents/:id')
  updateAgent(@Param('id') id: string, @Body() body: any) {
    return this.usersService.updateAgent(Number(id), body);
  }
}
