// src/users/users.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // 🔍 1) LISTAR AGENTES, ADMINS Y SUPER ADMINS
  // ============================================================
  async listAgentsAndAdmins() {
    const users = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              name: {
                in: ['admin', 'support', 'super-admin'], // 👈 incluimos super-admin
              },
            },
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return users.map((u) => {
      const roleNames = u.roles.map((r) => r.role.name);

      // Prioridad: super-admin > admin > support
      const mainRole = roleNames.includes('super-admin')
        ? 'super-admin'
        : roleNames.includes('admin')
          ? 'admin'
          : roleNames.includes('support')
            ? 'support'
            : 'unknown';

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        isActive: u.isActive,
        supportArea: u.supportArea,
        roles: roleNames,
        mainRole,
        createdAt: u.createdAt,
      };
    });
  }

  // ============================================================
  // 🆕 2) CREAR NUEVO AGENTE / ADMIN / SUPER ADMIN
  // ============================================================
  async createAgent(dto: CreateAgentDto) {
    const { email, password, name, role, supportArea } = dto;

    // 👇 ahora permitimos también super-admin
    if (!['admin', 'support', 'super-admin'].includes(role)) {
      throw new BadRequestException('Rol inválido para agente');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new BadRequestException(
        'Ya existe un usuario registrado con ese correo',
      );
    }

    const roleEntity = await this.prisma.role.findUnique({
      where: { name: role },
    });

    if (!roleEntity) {
      throw new BadRequestException(
        `No existe el rol "${role}". Verifica tu seed de roles.`,
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          isActive: true,
          supportArea: supportArea ?? null,
        },
      });

      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: roleEntity.id,
        },
      });

      return newUser;
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      supportArea: user.supportArea,
      isActive: user.isActive,
      mainRole: role,
    };
  }

  // ============================================================
  // ✏️ 3) ACTUALIZAR AGENTE / ADMIN / SUPER ADMIN
  // ============================================================
  async updateAgent(id: number, dto: UpdateAgentDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    let passwordHash: string | undefined;

    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 10);
    }

    // Si envían role, actualizamos el rol principal
    if (
      dto.role &&
      ['admin', 'support', 'super-admin'].includes(dto.role) // 👈 también super-admin
    ) {
      const newRole = await this.prisma.role.findUnique({
        where: { name: dto.role },
      });

      if (!newRole) {
        throw new BadRequestException(`Rol ${dto.role} no existe`);
      }

      await this.prisma.$transaction(async (tx) => {
        // Eliminamos relaciones actuales de roles "de staff"
        await tx.userRole.deleteMany({
          where: {
            userId: user.id,
            role: {
              name: { in: ['admin', 'support', 'super-admin'] }, // 👈 borramos cualquiera de estos
            },
          },
        });

        // Creamos la relación con el nuevo rol
        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: newRole.id,
          },
        });
      });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name ?? user.name,
        email: dto.email ?? user.email,
        supportArea:
          dto.supportArea !== undefined ? dto.supportArea : user.supportArea,
        isActive: dto.isActive !== undefined ? dto.isActive : user.isActive,
        ...(passwordHash ? { passwordHash } : {}),
      },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    const roleNames = updated.roles.map((r) => r.role.name);

    const mainRole = roleNames.includes('super-admin')
      ? 'super-admin'
      : roleNames.includes('admin')
        ? 'admin'
        : roleNames.includes('support')
          ? 'support'
          : 'unknown';

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      supportArea: updated.supportArea,
      isActive: updated.isActive,
      roles: roleNames,
      mainRole,
      createdAt: updated.createdAt,
    };
  }
  // ============================================================
  // 👥 4) CLIENTES (end-user)
  // ============================================================
  async listClients() {
    const users = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              name: 'end-user',
            },
          },
        },
      },
      include: {
        roles: { include: { role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      cargo: (u as any).cargo ?? null, // si añadiste estos campos al schema
      sede: (u as any).sede ?? null,
      supportArea: (u as any).supportArea ?? null,
      isActive: u.isActive,
      createdAt: u.createdAt,
    }));
  }

  // =========================================
  // 🆕 CREAR CLIENTE
  // =========================================
  async createClient(dto: CreateClientDto) {
    const { name, email, cargo, sede, password, clientArea } = dto as any;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException(
        'Ya existe un usuario registrado con ese correo',
      );
    }

    const role = await this.prisma.role.findUnique({
      where: { name: 'end-user' },
    });

    if (!role) {
      throw new BadRequestException(
        'No existe el rol "end-user". Revisa el seed de roles.',
      );
    }

    if (!password || !String(password).trim()) {
      throw new BadRequestException(
        'Debes enviar una contraseña para el cliente',
      );
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          isActive: dto.isActive ?? true,

          cargo: cargo ?? null,
          sede: sede ?? null,

          // ✅ Área del cliente (texto libre)
          clientArea: clientArea ?? null,

          // ⛔️ NO uses supportArea para clientes
          supportArea: null,
        },
      });

      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: role.id,
        },
      });

      return newUser;
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      cargo: (user as any).cargo ?? null,
      sede: (user as any).sede ?? null,
      clientArea: (user as any).clientArea ?? null,
      isActive: user.isActive,
    };
  }

  // =========================================
  // ✏️ ACTUALIZAR CLIENTE
  // =========================================
  async updateClient(id: number, dto: UpdateClientDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // ✅ si llega password, se actualiza
    let passwordHash: string | undefined;
    if (dto.password !== undefined) {
      const pwd = String(dto.password || '').trim();
      if (!pwd) {
        throw new BadRequestException('La contraseña no puede estar vacía');
      }
      passwordHash = await bcrypt.hash(pwd, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name ?? user.name,
        email: dto.email ?? user.email,

        cargo: dto.cargo ?? (user as any).cargo,
        sede: dto.sede ?? (user as any).sede,

        // ✅ área libre del cliente
        clientArea:
          (dto as any).clientArea !== undefined
            ? (dto as any).clientArea
            : (user as any).clientArea,

        // ⛔️ Asegura que un cliente no use supportArea
        supportArea: null,

        isActive: dto.isActive ?? user.isActive,

        ...(passwordHash ? { passwordHash } : {}),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      cargo: (updated as any).cargo ?? null,
      sede: (updated as any).sede ?? null,
      clientArea: (updated as any).clientArea ?? null,
      isActive: updated.isActive,
    };
  }
}
