import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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

  async createEntityType(data: { name: string; description: string; prompt: string }) {
    const existing = await this.prisma.entityType.findUnique({ where: { name: data.name } });
    if (existing) throw new ConflictException(`EntityType with name "${data.name}" already exists`);
    return this.prisma.entityType.create({ data });
  }

  async deleteEntityType(id: string) {
    const existing = await this.prisma.entityType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`EntityType ${id} not found`);
    await this.prisma.entityType.delete({ where: { id } });
  }

  async createFactType(data: { name: string; description: string; prompt: string; entityLinkHint?: string }) {
    const existing = await this.prisma.factType.findUnique({ where: { name: data.name } });
    if (existing) throw new ConflictException(`FactType with name "${data.name}" already exists`);
    return this.prisma.factType.create({ data });
  }

  async deleteFactType(id: string) {
    const existing = await this.prisma.factType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`FactType ${id} not found`);
    await this.prisma.factType.delete({ where: { id } });
  }
}
