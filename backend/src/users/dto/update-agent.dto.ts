// src/users/dto/update-agent.dto.ts
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo no es válido' })
  email?: string;

  @IsOptional()
  @IsString()
  cargo?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password?: string;

  @IsOptional()
  @IsIn(['support', 'admin', 'super-admin'], {
    message: 'Rol inválido (support | admin | super-admin)',
  })
  role?: 'support' | 'admin' | 'super-admin';

  @IsOptional()
  @IsString()
  supportArea?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
