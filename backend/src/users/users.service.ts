// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // 🔹 Helpers básicos (puede usarlos AuthService, etc.)
  // ============================================================

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Busca usuario por email.
   * Además, carga los nombres de roles en un arreglo `roles`.
   *
   * OJO: no usamos include.userRoles porque el tipo no lo tiene.
   * Consultamos la tabla intermedia userRole por separado.
   */
  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    // Traer los roles desde la tabla pivot UserRole
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: {
        role: true,
      },
    });

    const roles = userRoles.map((ur) => ur.role.name);

    // Devolvemos el usuario + arreglo de nombres de rol
    return {
      ...user,
      roles,
    };
  }

  // ============================================================
  // 🔥 1) LISTAR AGENTES
  //     - Solo usuarios con rol "support"
  //     - Sin usar where.userRoles (que ya no existe en los tipos)
  // ============================================================
  async listAgents() {
    // 1) Buscar el rol "support"
    const supportRole = await this.prisma.role.findUnique({
      where: { name: 'support' },
    });

    if (!supportRole) {
      throw new NotFoundException(
        'No se encontró el rol "support". Ejecuta el seed para crearlo.',
      );
    }

    // 2) Buscar todos los registros UserRole que tengan ese rol
    const pivotRows = await this.prisma.userRole.findMany({
      where: { roleId: supportRole.id },
      select: { userId: true },
    });

    const userIds = pivotRows.map((p) => p.userId);

    if (userIds.length === 0) {
      return [];
    }

    // 3) Traer la info de esos usuarios
    const agents = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        supportArea: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return agents;
  }

  // ============================================================
  // 🔥 2) CREAR AGENTE
  // body esperado: { name, email, password, supportArea?, isActive? }
  // ============================================================
  async createAgent(body: {
    name: string;
    email: string;
    password: string;
    supportArea?: string | null;
    isActive?: boolean;
  }) {
    const passwordHash = await bcrypt.hash(body.password, 10);

    // 1) Crear usuario
    const user = await this.prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        isActive: body.isActive ?? true,
        supportArea: body.supportArea ?? null,
      },
    });

    // 2) Buscar rol "support"
    const supportRole = await this.prisma.role.findUnique({
      where: { name: 'support' },
    });

    if (!supportRole) {
      throw new NotFoundException(
        'No se encontró el rol "support". Ejecuta el seed para crearlo.',
      );
    }

    // 3) Asignar rol "support" al usuario
    await this.prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: supportRole.id,
      },
    });

    return user;
  }

  // ============================================================
  // 🔥 3) ACTUALIZAR AGENTE
  // body puede traer: { name?, email?, password?, supportArea?, isActive? }
  // ============================================================
  async updateAgent(
    id: number,
    body: {
      name?: string;
      email?: string;
      password?: string;
      supportArea?: string | null;
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Agente no encontrado');
    }

    const data: any = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.email !== undefined) data.email = body.email;
    if (body.supportArea !== undefined) data.supportArea = body.supportArea;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    if (body.password) {
      data.passwordHash = await bcrypt.hash(body.password, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
    });

    return updated;
  }
}
