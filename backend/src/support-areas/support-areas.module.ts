// src/support-areas/support-areas.module.ts
import { Module } from '@nestjs/common';
import { SupportAreasService } from './support-areas.service';
import { SupportAreasController } from './support-areas.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SupportAreasController],
  providers: [SupportAreasService, PrismaService],
  exports: [SupportAreasService],
})
export class SupportAreasModule {}
