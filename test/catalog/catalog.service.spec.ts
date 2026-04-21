import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service';
import { CatalogService } from '../../src/catalog/catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CatalogService, PrismaService],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    await prisma.entityType.deleteMany();
    await prisma.factType.deleteMany();
  });

  describe('getEntityTypes', () => {
    it('returns all entity types with name and description', async () => {
      await prisma.entityType.create({
        data: {
          name: 'person',
          description: 'A named individual',
          prompt: 'Extract full names of individuals.',
        },
      });

      const result = await service.getEntityTypes();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('person');
      expect(result[0].description).toBe('A named individual');
    });
  });

  describe('getFactTypes', () => {
    it('returns all fact types with name and description', async () => {
      await prisma.factType.create({
        data: {
          name: 'monetary_amount',
          description: 'A monetary value',
          prompt: 'Extract explicit monetary values.',
        },
      });

      const result = await service.getFactTypes();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('monetary_amount');
      expect(result[0].description).toBe('A monetary value');
    });
  });
});
