// src/users/dto/create-agent.dto.ts
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateAgentDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  cargo?: string | null;

  @IsString()
  @MinLength(6)
  password: string;

  @IsIn(['support', 'admin', 'super-admin'])
  role: 'support' | 'admin' | 'super-admin';

  @IsOptional()
  @IsString()
  supportArea?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
