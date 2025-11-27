// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // 1) Validar credenciales
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const roles = user.roles.map((ur) => ur.role.name);

    // No devolvemos el passwordHash
    const { passwordHash, ...rest } = user;

    return {
      ...rest,
      roles,
    };
  }

  // 2) Login: genera el JWT
  async login(email: string, password: string) {
    if (!email || !password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const user = await this.validateUser(email, password);

    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
      },
    };
  }
}
