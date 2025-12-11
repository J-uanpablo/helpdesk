// src/support-areas/dto/create-support-area.dto.ts
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSupportAreaDto {
  @IsString()
  @MinLength(2, {
    message: 'El nombre del área debe tener al menos 2 caracteres.',
  })
  name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
