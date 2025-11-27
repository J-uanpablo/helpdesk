// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const roles = user.roles.map((ur) => ur.role.name);
    const { passwordHash, ...rest } = user;

    return {
      ...rest,
      roles,
    };
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return users.map((user) => {
      const roles = user.roles.map((ur) => ur.role.name);
      const { passwordHash, ...rest } = user;

      return {
        ...rest,
        roles,
      };
    });
  }
}
