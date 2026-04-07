// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';
import { SupportAreasModule } from './support-areas/support-areas.module';
import { FilesModule } from './files/files.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportsModule } from './reports/reports.module';
import { QuickRepliesModule } from './quick-replies/quick-replies.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    FilesModule,
    TicketsModule,
    UsersModule,
    SupportAreasModule,
    ReportsModule,
    QuickRepliesModule,
  ],
})
export class AppModule {}
