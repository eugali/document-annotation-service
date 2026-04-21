import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogSeeder } from './catalog.seeder';
import { CatalogController } from './catalog.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, CatalogSeeder, PrismaService],
  exports: [CatalogService],
})
export class CatalogModule {}
