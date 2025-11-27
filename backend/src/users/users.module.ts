// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  controllers: [UsersController],
  providers: [UsersService, RolesGuard],
})
export class UsersModule {}
