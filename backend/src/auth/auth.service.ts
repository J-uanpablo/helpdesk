// src/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

// ✅ EMAIL
import { sendMail } from '../services/mailer';
import { resetPasswordEmail } from '../emails/templates';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // ============================================================
  // LOGIN
  // ============================================================
  async login(email: string, password: string) {
    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.isActive === false) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

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

    const payload = {
      sub: user.id,
      email: user.email,
      roles,
    };

    const accessToken = this.jwtService.sign(payload);

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
  // CAMBIAR CONTRASEÑA DESDE SESIÓN ACTIVA
  // ============================================================
  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.isActive === false) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    const currentPassword = String(dto.currentPassword || '').trim();
    const newPassword = String(dto.newPassword || '').trim();

    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Debes completar todos los campos');
    }

    if (newPassword.length < 8) {
      throw new BadRequestException(
        'La nueva contraseña debe tener al menos 8 caracteres',
      );
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);

    if (isSamePassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente a la actual',
      );
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return {
      ok: true,
      message: 'Contraseña actualizada correctamente',
    };
  }

  // ============================================================
  // FORGOT PASSWORD (ENVÍA EMAIL CON LINK)
  // ============================================================
  async forgotPassword(email: string) {
    const normalizedEmail = String(email).trim().toLowerCase();

    const okResponse = {
      message:
        'Si el correo existe, te enviaremos un enlace para restablecer la contraseña.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.isActive === false) return okResponse;

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

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

    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(
      user.email,
    )}`;

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
    }

    return okResponse;
  }

  // ============================================================
  // RESET PASSWORD (VALIDA TOKEN, CAMBIA PASSWORD)
  // ============================================================
  async resetPassword(email: string, token: string, newPassword: string) {
    const normalizedEmail = String(email).trim().toLowerCase();

    if (!token?.trim()) {
      throw new BadRequestException('Token inválido o vencido');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException(
        'La contraseña debe tener mínimo 8 caracteres',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
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
