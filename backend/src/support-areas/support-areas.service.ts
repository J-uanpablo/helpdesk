// src/support-areas/support-areas.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupportAreasService {
  constructor(private readonly prisma: PrismaService) {}

  // Crear área
  async create(name: string) {
    const area = await this.prisma.supportArea.create({
      data: { name: name.trim() },
    });

    return area;
  }

  // Listar todas (opcionalmente solo activas)
  async findAll(options?: { onlyActive?: boolean }) {
    const where: any = {};
    if (options?.onlyActive) {
      where.isActive = true;
    }

    return this.prisma.supportArea.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  // Obtener una área por id
  async findOne(id: number) {
    const area = await this.prisma.supportArea.findUnique({
      where: { id },
    });

    if (!area) {
      throw new NotFoundException('Área de soporte no encontrada');
    }

    return area;
  }

  // Actualizar nombre / estado
  async update(id: number, data: { name?: string; isActive?: boolean }) {
    const existing = await this.prisma.supportArea.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Área de soporte no encontrada');
    }

    return this.prisma.supportArea.update({
      where: { id },
      data: {
        name: data.name?.trim() ?? existing.name,
        isActive:
          typeof data.isActive === 'boolean'
            ? data.isActive
            : existing.isActive,
      },
    });
  }

  // "Eliminar" → la marcamos como inactiva (soft delete)
  async softDelete(id: number) {
    const existing = await this.prisma.supportArea.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Área de soporte no encontrada');
    }

    return this.prisma.supportArea.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
