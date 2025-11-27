import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AssignTicketDto {
  @IsInt()
  @Min(1)
  assignedToId: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
