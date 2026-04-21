import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service';
import { CatalogSeeder } from '../../src/catalog/catalog.seeder';

describe('CatalogSeeder', () => {
  let seeder: CatalogSeeder;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CatalogSeeder, PrismaService],
    }).compile();

    seeder = module.get<CatalogSeeder>(CatalogSeeder);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    await prisma.documentEntity.deleteMany();
    await prisma.documentFact.deleteMany();
    await prisma.entity.deleteMany();
    await prisma.fact.deleteMany();
    await prisma.entityType.deleteMany();
    await prisma.factType.deleteMany();
  });

  it('seeds entity types from catalog JSON', async () => {
    await seeder.seed();

    const entityTypes = await prisma.entityType.findMany();

    expect(entityTypes.length).toBeGreaterThanOrEqual(3);
    const person = entityTypes.find((e) => e.name === 'person');
    expect(person).toBeDefined();
    expect(person!.description).toContain('named individual');
  });

  it('seeds fact types from catalog JSON', async () => {
    await seeder.seed();

    const factTypes = await prisma.factType.findMany();

    expect(factTypes.length).toBeGreaterThanOrEqual(4);
    const monetary = factTypes.find((f) => f.name === 'monetary_amount');
    expect(monetary).toBeDefined();
    expect(monetary!.description).toContain('monetary value');
  });

  it('is idempotent — running twice does not duplicate', async () => {
    await seeder.seed();
    await seeder.seed();

    const entityTypes = await prisma.entityType.findMany();
    const uniqueNames = new Set(entityTypes.map((e) => e.name));
    expect(entityTypes.length).toBe(uniqueNames.size);
  });

  it('updates descriptions on re-seed', async () => {
    await seeder.seed();
    const before = await prisma.entityType.findUnique({
      where: { name: 'person' },
    });

    await prisma.entityType.update({
      where: { name: 'person' },
      data: { description: 'old description' },
    });

    await seeder.seed();
    const after = await prisma.entityType.findUnique({
      where: { name: 'person' },
    });

    expect(after!.description).not.toBe('old description');
    expect(after!.description).toBe(before!.description);
  });
});
