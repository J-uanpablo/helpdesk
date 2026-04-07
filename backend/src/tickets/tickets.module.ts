import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { TicketsGateway } from './tickets.gateway';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TicketsAutoCloseService } from './tickets.autoclose.service';

@Module({
  imports: [AuthModule, FilesModule, PrismaModule],
  controllers: [TicketsController],
  providers: [TicketsService, TicketsGateway, TicketsAutoCloseService],
  exports: [TicketsService],
})
export class TicketsModule {}
