// src/tickets/tickets.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';

import { TicketStatus } from '@prisma/client';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TicketsService } from './tickets.service';
import { FilesService } from '../files/files.service';
import { multerMemoryOptions } from '../files/multer.config';
import { TicketsGateway } from './tickets.gateway';

type CurrentUser = { id: number; roles?: string[] };

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly filesService: FilesService,
    private readonly ticketsGateway: TicketsGateway,
  ) {}

  private getCurrentUser(req: Request): CurrentUser {
    const u: any = (req as any).user;
    return { id: Number(u?.id), roles: Array.isArray(u?.roles) ? u.roles : [] };
  }

  /**
   * POST /tickets
   * form-data:
   *  - subject (string)
   *  - description (string)
   *  - area (string)
   *  - files[] (0..10)
   */
  @Post()
  @UseInterceptors(FilesInterceptor('files', 10, multerMemoryOptions))
  async create(
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    const user = this.getCurrentUser(req);

    // ✅ Sin adjuntos
    if (!files || files.length === 0) {
      const created = await this.ticketsService.create(body, user.id);

      if (!created) {
        // si tu service devuelve null, algo falló o no creó el ticket
        throw new Error('No se pudo crear el ticket');
      }

      this.ticketsGateway.emitNewTicket(created);
      return created;
    }

    // ✅ Con adjuntos => guardar archivos primero
    const saved = await Promise.all(
      files.map((f) => this.filesService.saveFile(f, 'tickets')),
    );

    const created = await this.ticketsService.createWithAttachments(
      body,
      user.id,
      saved,
    );
    if (created) {
      this.ticketsGateway.emitNewTicket(created);
    }

    if (!created) {
      throw new Error('No se pudo crear el ticket con adjuntos');
    }

    // 🔔 Notificar a agentes/admin (por área si existe)
    this.ticketsGateway.emitNewTicket(created);

    return created;
  }

  /**
   * GET /tickets/my
   */
  @Get('my')
  async findMy(@Req() req: Request) {
    const user = this.getCurrentUser(req);
    return this.ticketsService.findMy(user.id);
  }

  /**
   * GET /tickets/panel-list
   */
  @Get('panel-list')
  async panelList(@Req() req: Request) {
    const user = this.getCurrentUser(req);
    return this.ticketsService.getTicketsForPanel(user);
  }

  /**
   * GET /tickets/:id
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ticketsService.findOne(id);
  }

  /**
   * GET /tickets/:id/messages
   */
  @Get(':id/messages')
  async getMessages(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    // si luego quieres validar permisos por usuario, aquí tienes el user:
    // const user = this.getCurrentUser(req);
    return this.ticketsService.getMessages(id);
  }

  /**
   * POST /tickets/:id/messages
   * form-data:
   *  - content (string, opcional si envías file)
   *  - file (1 archivo opcional)
   */
  @Post(':id/messages')
  @UseInterceptors(FileInterceptor('file', multerMemoryOptions))
  async addMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content?: string },
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const user = this.getCurrentUser(req);

    const saved = file
      ? await this.filesService.saveFile(file, 'messages')
      : undefined;

    return this.ticketsService.addMessageWithAttachment({
      ticketId: id,
      content: body?.content ?? '',
      senderId: user.id,
      file: saved
        ? {
            originalName: saved.originalName,
            filename: saved.filename,
            mimeType: saved.mimeType,
            size: saved.size,
            path: saved.path,
          }
        : undefined,
    });
  }

  /**
   * PATCH /tickets/:id/status
   * body: { status: TicketStatus, note?: string }
   */
  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: TicketStatus; note?: string },
    @Req() req: Request,
  ) {
    const user = this.getCurrentUser(req);
    return this.ticketsService.updateStatus(id, body.status, user, body.note);
  }

  /**
   * PATCH /tickets/:id/assign-me
   */
  @Patch(':id/assign-me')
  async assignMe(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = this.getCurrentUser(req);
    return this.ticketsService.assignMe(id, user);
  }

  /**
   * PATCH /tickets/:id/open
   */
  @Patch(':id/open')
  async openForAgent(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const user = this.getCurrentUser(req);
    return this.ticketsService.openForAgent(id, user);
  }
}
