import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TicketsModule } from './tickets/tickets.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, TicketsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
