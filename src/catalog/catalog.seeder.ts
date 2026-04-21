import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogSeed, CatalogTypeDef } from './catalog.types';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CatalogSeeder implements OnModuleInit {
  private readonly logger = new Logger(CatalogSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seed();
  }

  async seed(): Promise<void> {
    const catalogPath = path.join(
      process.cwd(),
      'prisma',
      'seed',
      'catalog.json',
    );
    const raw = fs.readFileSync(catalogPath, 'utf-8');
    const catalog: CatalogSeed = JSON.parse(raw) as CatalogSeed;
    this.validateCatalog(catalog);

    for (const entry of catalog.entities) {
      await this.upsertEntityType(entry);
    }
    for (const entry of catalog.facts) {
      await this.upsertFactType(entry);
    }

    this.logger.log(
      `Seeded ${catalog.entities.length} entity types, ${catalog.facts.length} fact types`,
    );
  }

  private async upsertEntityType(entry: CatalogTypeDef): Promise<void> {
    await this.prisma.entityType.upsert({
      where: { name: entry.name },
      update: { description: entry.description, prompt: entry.prompt },
      create: { name: entry.name, description: entry.description, prompt: entry.prompt },
    });
  }

  private async upsertFactType(entry: CatalogTypeDef): Promise<void> {
    await this.prisma.factType.upsert({
      where: { name: entry.name },
      update: { description: entry.description, prompt: entry.prompt },
      create: { name: entry.name, description: entry.description, prompt: entry.prompt },
    });
  }

  private validateCatalog(catalog: CatalogSeed): void {
    if (!catalog.entities || !Array.isArray(catalog.entities)) {
      throw new Error('Catalog JSON must have an "entities" array');
    }
    if (!catalog.facts || !Array.isArray(catalog.facts)) {
      throw new Error('Catalog JSON must have a "facts" array');
    }
    for (const entry of [...catalog.entities, ...catalog.facts]) {
      if (!entry.name || !entry.description || !entry.prompt) {
        throw new Error(
          `Catalog entry "${entry.name || 'unknown'}" must have name, description, and prompt`,
        );
      }
    }
  }
}
