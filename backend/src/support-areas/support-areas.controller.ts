// src/support-areas/support-areas.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SupportAreasService } from './support-areas.service';
import { CreateSupportAreaDto } from './dto/create-support-area.dto';
import { UpdateSupportAreaDto } from './dto/update-support-area.dto';

// Ajusta estos imports si ya tienes guards propios
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { RolesGuard } from '../auth/roles.guard';
// import { Roles } from '../auth/roles.decorator';

@Controller('support-areas')
@UseGuards(JwtAuthGuard /*, RolesGuard*/)
// @Roles('admin') // 👈 descomenta si ya usas un decorador de roles
export class SupportAreasController {
  constructor(private readonly supportAreasService: SupportAreasService) {}

  // POST /support-areas
  @Post()
  create(@Body() dto: CreateSupportAreaDto) {
    return this.supportAreasService.create(dto.name);
  }

  // GET /support-areas?onlyActive=true
  @Get()
  findAll(@Query('onlyActive') onlyActive?: string) {
    const flag = onlyActive === 'true' || onlyActive === '1';
    return this.supportAreasService.findAll(flag ? { onlyActive: true } : {});
  }

  // GET /support-areas/:id
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.supportAreasService.findOne(id);
  }

  // PATCH /support-areas/:id
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupportAreaDto,
  ) {
    return this.supportAreasService.update(id, dto);
  }

  // DELETE /support-areas/:id → soft delete (isActive=false)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.supportAreasService.softDelete(id);
  }
}
