// src/support-areas/dto/update-support-area.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateSupportAreaDto } from './create-support-area.dto';

export class UpdateSupportAreaDto extends PartialType(CreateSupportAreaDto) {}
