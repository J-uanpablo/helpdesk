import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TicketStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(TicketStatus)
  status: TicketStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
