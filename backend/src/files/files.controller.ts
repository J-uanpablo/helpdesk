import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type CurrentUser = { id: number; roles?: string[] };

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  private getCurrentUser(req: Request): CurrentUser {
    const u: any = (req as any).user;
    return { id: Number(u?.id), roles: Array.isArray(u?.roles) ? u.roles : [] };
  }

  // ✅ GET /files/attachment/:id  (descarga forzada)
  @Get('attachment/:id')
  async downloadAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = this.getCurrentUser(req);
    const file = await this.filesService.getAttachmentForDownload(id, user);

    // Content-Type real del archivo
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');

    // ✅ Nombre compatible: filename + filename* (UTF-8)
    const safeAscii = String(file.filename || 'archivo')
      .replace(/[\r\n"]/g, '')
      .replace(/[^\x20-\x7E]+/g, '_'); // solo ASCII para filename=""

    const encoded = encodeURIComponent(file.filename || 'archivo');

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeAscii}"; filename*=UTF-8''${encoded}`,
    );

    // Opcional: evita cache raro
    res.setHeader('Cache-Control', 'no-store');

    // Express requiere path absoluto (ya lo envías así)
    return res.sendFile(file.absPath);
  }
}
