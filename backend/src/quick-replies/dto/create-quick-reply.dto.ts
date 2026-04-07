import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateQuickReplyDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
