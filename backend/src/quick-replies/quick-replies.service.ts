import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuickReplyDto } from './dto/create-quick-reply.dto';
import { UpdateQuickReplyDto } from './dto/update-quick-reply.dto';

type CurrentUser = { id: number; roles?: string[] };

@Injectable()
export class QuickRepliesService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(user: CurrentUser) {
    return this.prisma.quickReply.findMany({
      where: { createdById: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createMine(user: CurrentUser, dto: CreateQuickReplyDto) {
    const title = dto.title?.trim();
    const content = dto.content?.trim();

    if (!title) throw new BadRequestException('El título es obligatorio.');
    if (!content) throw new BadRequestException('El contenido es obligatorio.');

    return this.prisma.quickReply.create({
      data: {
        title,
        content,
        isActive: dto.isActive ?? true,
        createdById: user.id,
      },
      select: {
        id: true,
        title: true,
        content: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateMine(user: CurrentUser, id: number, dto: UpdateQuickReplyDto) {
    const existing = await this.prisma.quickReply.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });
    if (!existing) throw new NotFoundException('Plantilla no encontrada.');

    if (existing.createdById !== user.id) {
      throw new ForbiddenException(
        'No puedes editar plantillas de otro usuario.',
      );
    }

    return this.prisma.quickReply.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: {
        id: true,
        title: true,
        content: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async removeMine(user: CurrentUser, id: number) {
    const existing = await this.prisma.quickReply.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });
    if (!existing) throw new NotFoundException('Plantilla no encontrada.');

    if (existing.createdById !== user.id) {
      throw new ForbiddenException(
        'No puedes eliminar plantillas de otro usuario.',
      );
    }

    await this.prisma.quickReply.delete({ where: { id } });
    return { ok: true };
  }
}
