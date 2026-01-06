// src/files/multer.config.ts
import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

const MAX_SIZE = 15 * 1024 * 1024; // 15MB

export const multerMemoryOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req: any, file: Express.Multer.File, cb: any) => {
    // Bloquea ejecutables comunes
    const blocked = ['application/x-msdownload', 'application/x-dosexec'];
    if (blocked.includes(file.mimetype)) {
      return cb(new BadRequestException('Tipo de archivo no permitido'), false);
    }
    cb(null, true);
  },
};
