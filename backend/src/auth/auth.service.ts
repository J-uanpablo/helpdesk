// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Autentica por email/contraseña y genera JWT
   */
  async login(email: string, password: string) {
    // 1) Buscar usuario (SIN include raro)
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 2) Verificar contraseña
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3) Sacar roles del usuario desde la tabla UserRole + Role

    // 3.1: buscar filas de userRole de ese usuario
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
    });

    // si no tiene filas, no tiene roles
    let roles: string[] = [];

    if (userRoles.length > 0) {
      const roleIds = userRoles.map((ur) => ur.roleId);

      // 3.2: buscar los roles por id
      const rolesFromDb = await this.prisma.role.findMany({
        where: { id: { in: roleIds } },
      });

      roles = rolesFromDb.map((r) => r.name);
    }

    // 4) Payload del JWT
    const payload = {
      sub: user.id,
      email: user.email,
      roles, // 👈 MUY IMPORTANTE
    };

    // 5) Firmar token
    const accessToken = this.jwtService.sign(payload);

    // 6) Lo que enviamos al frontend
    return {
      access_token: accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles,
      },
    };
  }
}
