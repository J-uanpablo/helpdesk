import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateQuickReplyDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
