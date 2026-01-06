// src/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

// ✅ EMAIL
import { sendMail } from '../services/mailer';
import { resetPasswordEmail } from '../emails/templates';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // ============================================================
  // LOGIN (DEJADO COMO LO TIENES)
  // ============================================================
  async login(email: string, password: string) {
    // 1) Buscar usuario
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // opcional: si manejas inactivos
    if (user.isActive === false) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 2) Verificar contraseña
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3) Sacar roles del usuario desde UserRole + Role
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
    });

    let roles: string[] = [];

    if (userRoles.length > 0) {
      const roleIds = userRoles.map((ur) => ur.roleId);

      const rolesFromDb = await this.prisma.role.findMany({
        where: { id: { in: roleIds } },
      });

      roles = rolesFromDb.map((r) => r.name);
    }

    // 4) Payload JWT
    const payload = {
      sub: user.id,
      email: user.email,
      roles,
    };

    // 5) Firmar token
    const accessToken = this.jwtService.sign(payload);

    // 6) Respuesta
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

  // ============================================================
  // FORGOT PASSWORD (ENVÍA EMAIL CON LINK)
  // ============================================================
  async forgotPassword(email: string) {
    const okResponse = {
      message:
        'Si el correo existe, te enviaremos un enlace para restablecer la contraseña.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Respuesta neutra siempre (seguridad)
    if (!user || user.isActive === false) return okResponse;

    // 1) Invalidar tokens anteriores no usados
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // 2) Crear token (guardamos HASH en DB)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const ttlMinutes = Number(process.env.RESET_TOKEN_TTL_MIN || 30);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // 3) Armar link
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(
      user.email,
    )}`;

    // 4) Enviar correo (no romper si falla SMTP)
    try {
      await sendMail({
        to: user.email,
        subject: 'Restablecer contraseña',
        html: resetPasswordEmail({
          name: user.name || 'Usuario',
          resetUrl,
          ttlMinutes,
        }),
      });
    } catch (err) {
      console.error('❌ Error enviando email de reset:', err);
      // Igual devolvemos respuesta neutra
    }

    return okResponse;
  }

  // ============================================================
  // RESET PASSWORD (VALIDA TOKEN, CAMBIA PASSWORD)
  // ============================================================
  async resetPassword(email: string, token: string, newPassword: string) {
    if (!token?.trim()) {
      throw new BadRequestException('Token inválido o vencido');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException(
        'La contraseña debe tener mínimo 8 caracteres',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.isActive === false) {
      throw new BadRequestException('Token inválido o vencido');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      throw new BadRequestException('Token inválido o vencido');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Contraseña actualizada correctamente.' };
  }
}
