import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getEntityTypes() {
    return this.prisma.entityType.findMany();
  }

  async getFactTypes() {
    return this.prisma.factType.findMany();
  }

  async getCatalog() {
    const [entityTypes, factTypes] = await Promise.all([
      this.getEntityTypes(),
      this.getFactTypes(),
    ]);
    return { entityTypes, factTypes };
  }

  async updateEntityType(id: string, data: { description?: string; prompt?: string }) {
    const existing = await this.prisma.entityType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`EntityType ${id} not found`);
    return this.prisma.entityType.update({ where: { id }, data });
  }

  async updateFactType(id: string, data: { description?: string; prompt?: string }) {
    const existing = await this.prisma.factType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`FactType ${id} not found`);
    return this.prisma.factType.update({ where: { id }, data });
  }
}
