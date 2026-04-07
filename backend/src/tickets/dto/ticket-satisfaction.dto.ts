// src/tickets/dto/ticket-satisfaction.dto.ts
import {
  IsInt,
  Max,
  Min,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class TicketSatisfactionDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
