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
                in: ['admin', 'support', 'super-admin'],
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
        cargo: (u as any).cargo ?? null,
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
  //    ✅ Si ya existe como cliente, lo convierte a agente
  // ============================================================
  async createAgent(dto: CreateAgentDto) {
    const { email, password, name, cargo, role, supportArea, isActive } = dto;

    const normalizedEmail = String(email).trim().toLowerCase();

    if (!['admin', 'support', 'super-admin'].includes(role)) {
      throw new BadRequestException('Rol inválido para agente');
    }

    if (role === 'support' && !supportArea) {
      throw new BadRequestException(
        'supportArea es obligatoria para role=support',
      );
    }

    const finalSupportArea =
      role === 'support' ? String(supportArea).trim() : null;

    const roleEntity = await this.prisma.role.findUnique({
      where: { name: role },
    });

    if (!roleEntity) {
      throw new BadRequestException(
        `No existe el rol "${role}". Verifica tu seed de roles.`,
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    const passwordHash = await bcrypt.hash(String(password), 10);

    // ------------------------------------------------------------
    // CASO 1: No existe => crear agente nuevo
    // ------------------------------------------------------------
    if (!existing) {
      const user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            name: String(name).trim(),
            cargo: cargo ? String(cargo).trim() : null,
            isActive: isActive ?? true,
            supportArea: finalSupportArea,
            sede: null,
            clientArea: null,
          },
        });

        await tx.userRole.create({
          data: {
            userId: newUser.id,
            roleId: roleEntity.id,
          },
        });

        return tx.user.findUniqueOrThrow({
          where: { id: newUser.id },
          include: {
            roles: {
              include: { role: true },
            },
          },
        });
      });

      const roleNames = user.roles.map((r) => r.role.name);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        cargo: (user as any).cargo ?? null,
        supportArea: user.supportArea,
        isActive: user.isActive,
        roles: roleNames,
        mainRole: role,
        createdAt: user.createdAt,
        convertedFromClient: false,
      };
    }

    // ------------------------------------------------------------
    // CASO 2: Ya existe
    // ------------------------------------------------------------
    const existingRoleNames = existing.roles.map((r) => r.role.name);

    const alreadyStaff = existingRoleNames.some((r) =>
      ['admin', 'support', 'super-admin'].includes(r),
    );

    if (alreadyStaff) {
      throw new BadRequestException(
        'Ya existe un usuario registrado con ese correo',
      );
    }

    const isClient = existingRoleNames.includes('end-user');

    if (!isClient) {
      throw new BadRequestException(
        'Ya existe un usuario con ese correo y no puede convertirse a agente',
      );
    }

    // ------------------------------------------------------------
    // CASO 3: Existe como cliente => convertirlo a agente
    // ------------------------------------------------------------
    const converted = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: {
          userId: existing.id,
          role: {
            name: 'end-user',
          },
        },
      });

      await tx.userRole.create({
        data: {
          userId: existing.id,
          roleId: roleEntity.id,
        },
      });

      await tx.user.update({
        where: { id: existing.id },
        data: {
          name: String(name).trim(),
          email: normalizedEmail,
          passwordHash,
          cargo: cargo ? String(cargo).trim() : null,
          isActive: isActive ?? true,
          supportArea: finalSupportArea,
          sede: null,
          clientArea: null,
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: existing.id },
        include: {
          roles: {
            include: { role: true },
          },
        },
      });
    });

    const convertedRoleNames = converted.roles.map((r) => r.role.name);

    return {
      id: converted.id,
      name: converted.name,
      email: converted.email,
      cargo: (converted as any).cargo ?? null,
      supportArea: converted.supportArea,
      isActive: converted.isActive,
      roles: convertedRoleNames,
      mainRole: role,
      createdAt: converted.createdAt,
      convertedFromClient: true,
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
      passwordHash = await bcrypt.hash(String(dto.password), 10);
    }

    if (dto.role && ['admin', 'support', 'super-admin'].includes(dto.role)) {
      const newRole = await this.prisma.role.findUnique({
        where: { name: dto.role },
      });

      if (!newRole) {
        throw new BadRequestException(`Rol ${dto.role} no existe`);
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.userRole.deleteMany({
          where: {
            userId: user.id,
            role: {
              name: { in: ['admin', 'support', 'super-admin'] },
            },
          },
        });

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
        name: dto.name !== undefined ? String(dto.name).trim() : user.name,
        email:
          dto.email !== undefined
            ? String(dto.email).trim().toLowerCase()
            : user.email,
        cargo:
          dto.cargo !== undefined
            ? dto.cargo
              ? String(dto.cargo).trim()
              : null
            : (user as any).cargo,
        supportArea:
          dto.supportArea !== undefined
            ? dto.supportArea
              ? String(dto.supportArea).trim()
              : null
            : user.supportArea,
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
      cargo: (updated as any).cargo ?? null,
      supportArea: updated.supportArea,
      isActive: updated.isActive,
      roles: roleNames,
      mainRole,
      createdAt: updated.createdAt,
    };
  }

  // ============================================================
  // 👥 4) CLIENTES (end-user)
  //    ✅ Solo lista usuarios que todavía tengan rol end-user
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
      cargo: (u as any).cargo ?? null,
      sede: (u as any).sede ?? null,
      clientArea: (u as any).clientArea ?? null,
      isActive: u.isActive,
      createdAt: u.createdAt,
    }));
  }

  // =========================================
  // 🆕 CREAR CLIENTE
  // =========================================
  async createClient(dto: CreateClientDto) {
    const { name, email, cargo, sede, password, clientArea } = dto as any;

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (existing) {
      const existingRoleNames = existing.roles.map((r) => r.role.name);
      const isClient = existingRoleNames.includes('end-user');

      if (isClient) {
        throw new BadRequestException(
          'Ya existe un usuario registrado con ese correo',
        );
      }

      throw new BadRequestException(
        'Ese correo ya pertenece a un agente o administrador',
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
          email: normalizedEmail,
          passwordHash,
          name: String(name).trim(),
          isActive: dto.isActive ?? true,
          cargo: cargo ? String(cargo).trim() : null,
          sede: sede ? String(sede).trim() : null,
          clientArea: clientArea ? String(clientArea).trim() : null,
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
        name: dto.name !== undefined ? String(dto.name).trim() : user.name,
        email:
          dto.email !== undefined
            ? String(dto.email).trim().toLowerCase()
            : user.email,
        cargo:
          dto.cargo !== undefined
            ? dto.cargo
              ? String(dto.cargo).trim()
              : null
            : (user as any).cargo,
        sede:
          dto.sede !== undefined
            ? dto.sede
              ? String(dto.sede).trim()
              : null
            : (user as any).sede,
        clientArea:
          (dto as any).clientArea !== undefined
            ? (dto as any).clientArea
              ? String((dto as any).clientArea).trim()
              : null
            : (user as any).clientArea,
        supportArea: null,
        isActive: dto.isActive !== undefined ? dto.isActive : user.isActive,
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

  // =========================================
  // 🗑️ ELIMINAR CLIENTE
  //    ✅ Ya no borra físicamente: desactiva
  // =========================================
  async deleteClient(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const roleNames = user.roles.map((r) => r.role.name);
    const isClient = roleNames.includes('end-user');

    if (!isClient) {
      throw new BadRequestException('El usuario no es un cliente');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return { ok: true, id: updated.id, isActive: updated.isActive };
  }

  // =========================================
  // ✏️ ELIMINAR AGENTE / ADMIN / SUPER ADMIN (SOFT DELETE)
  // =========================================
  async deleteAgent(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const roleNames = user.roles.map((r) => r.role.name);
    const isStaff = roleNames.some((r) =>
      ['admin', 'support', 'super-admin'].includes(r),
    );

    if (!isStaff) {
      throw new BadRequestException('El usuario no es un agente/admin');
    }

    if (roleNames.includes('super-admin')) {
      throw new BadRequestException('No puedes eliminar un super-admin');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { ok: true, id: updated.id, isActive: updated.isActive };
  }
}
