import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

type CurrentUser = { id: number; roles?: string[] };

@Controller('quick-replies')
@UseGuards(JwtAuthGuard)
export class QuickRepliesController {
  constructor(private readonly prisma: PrismaService) {}

  private getCurrentUser(req: Request): CurrentUser {
    const u: any = (req as any).user;
    return { id: Number(u?.id), roles: Array.isArray(u?.roles) ? u.roles : [] };
  }

  @Get()
  async list(@Req() req: Request) {
    const user = this.getCurrentUser(req);

    return this.prisma.quickReply.findMany({
      where: { createdById: user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  @Post()
  async create(
    @Req() req: Request,
    @Body() body: { title?: string; content?: string },
  ) {
    const user = this.getCurrentUser(req);

    const title = (body.title ?? '').trim();
    const content = (body.content ?? '').trim();
    if (!title) throw new BadRequestException('El título es obligatorio.');
    if (!content) throw new BadRequestException('El contenido es obligatorio.');

    return this.prisma.quickReply.create({
      data: {
        title,
        content,
        createdById: user.id,
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { title?: string; content?: string; isActive?: boolean },
  ) {
    const user = this.getCurrentUser(req);
    const quickReplyId = Number(id);
    if (!quickReplyId) throw new BadRequestException('ID inválido.');

    const existing = await this.prisma.quickReply.findUnique({
      where: { id: quickReplyId },
    });
    if (!existing) throw new NotFoundException('Plantilla no encontrada.');
    if (existing.createdById !== user.id)
      throw new ForbiddenException('No autorizado.');

    const data: any = {};
    if (typeof body.title === 'string') data.title = body.title.trim();
    if (typeof body.content === 'string') data.content = body.content.trim();
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;

    if (data.title === '')
      throw new BadRequestException('El título no puede estar vacío.');
    if (data.content === '')
      throw new BadRequestException('El contenido no puede estar vacío.');

    return this.prisma.quickReply.update({
      where: { id: quickReplyId },
      data,
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = this.getCurrentUser(req);
    const quickReplyId = Number(id);
    if (!quickReplyId) throw new BadRequestException('ID inválido.');

    const existing = await this.prisma.quickReply.findUnique({
      where: { id: quickReplyId },
    });
    if (!existing) throw new NotFoundException('Plantilla no encontrada.');
    if (existing.createdById !== user.id)
      throw new ForbiddenException('No autorizado.');

    await this.prisma.quickReply.delete({ where: { id: quickReplyId } });
    return { ok: true };
  }
}
