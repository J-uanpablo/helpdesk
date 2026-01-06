// src/files/files.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

type CurrentUser = { id: number; roles?: string[] };

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user: CurrentUser) {
    const r = user.roles || [];
    return r.includes('admin') || r.includes('super-admin');
  }

  /**
   * ✅ GUARDA ARCHIVOS (MULTER MEMORY)
   * - Crea: /uploads/<folder> si no existe
   * - Guarda file.buffer
   * - Devuelve lo que tu tickets.controller.ts espera
   *
   * folder: 'tickets' | 'messages'
   */
  async saveFile(
    file: Express.Multer.File,
    folder: 'tickets' | 'messages',
  ): Promise<{
    originalName: string;
    filename: string;
    mimeType: string;
    size: number;
    path: string;
  }> {
    const uploadsRoot = path.join(process.cwd(), 'uploads');
    const targetDir = path.join(uploadsRoot, folder);

    // asegura carpeta
    await fs.promises.mkdir(targetDir, { recursive: true });

    const originalName = file.originalname || 'archivo';

    // limpia nombre (seguridad)
    const safeOriginal = originalName.replace(/[^\w.\-()\s]/g, '_').trim();

    const ext = safeOriginal.includes('.')
      ? '.' + safeOriginal.split('.').pop()
      : '';

    const filename = `${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}${ext}`;

    const absPath = path.join(targetDir, filename);

    // multer memory => file.buffer
    await fs.promises.writeFile(absPath, file.buffer);

    return {
      originalName,
      filename,
      mimeType: file.mimetype || 'application/octet-stream',
      size: Number(file.size || 0),
      // ✅ guarda relativo a /uploads
      path: `uploads/${folder}/${filename}`,
    };
  }

  async getAttachmentForDownload(attachmentId: number, user: CurrentUser) {
    const att = await this.prisma.ticketAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        ticket: {
          select: {
            id: true,
            createdById: true,
            assignedToId: true,
          },
        },
      },
    });

    if (!att) throw new NotFoundException('Adjunto no encontrado');

    // ✅ Permisos:
    // Admin/Super: OK
    // Dueño del ticket: OK
    // Agente asignado: OK
    const isOwner = att.ticket.createdById === user.id;
    const isAssigned =
      !!att.ticket.assignedToId && att.ticket.assignedToId === user.id;

    if (!this.isAdmin(user) && !isOwner && !isAssigned) {
      throw new ForbiddenException(
        'No tienes permiso para descargar este archivo',
      );
    }

    // Path absoluto al archivo en disco
    const rel = (att.path || att.filename || '').replace(/^\/+/, '');
    const abs = path.join(
      process.cwd(),
      rel.startsWith('uploads/') ? rel : `uploads/${rel}`,
    );

    if (!fs.existsSync(abs))
      throw new NotFoundException('Archivo no existe en disco');

    return {
      absPath: abs,
      filename: att.filename,
      mimeType: att.mimeType || 'application/octet-stream',
    };
  }
}
