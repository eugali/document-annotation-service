import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { persistResults } from '../../../src/processing/pipeline/steps/persist-results.step';
import {
  ExtractedEntity,
  ExtractedFact,
  DedupedEntity,
} from '../../../src/processing/pipeline/pipeline.types';

describe('persistResults', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
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
    await prisma.document.deleteMany();
    await prisma.entityType.deleteMany();
    await prisma.factType.deleteMany();
  });

  it('persists entities and facts via join tables', async () => {
    await prisma.entityType.create({
      data: { name: 'person', description: 'A named individual', prompt: 'Extract full names.' },
    });
    await prisma.factType.create({
      data: { name: 'monetary_amount', description: 'A monetary value', prompt: 'Extract monetary values.' },
    });

    const doc = await prisma.document.create({
      data: {
        id: 'doc-persist-1',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        filePath: '/tmp/test.pdf',
        status: 'processing',
      },
    });

    const entities: ExtractedEntity[] = [
      { typeName: 'person', name: 'Bob Smith' },
    ];

    const facts: ExtractedFact[] = [
      { typeName: 'monetary_amount', value: 'EUR 50,000' },
    ];

    await persistResults(prisma, doc.id, entities, facts);

    const savedEntities = await prisma.documentEntity.findMany({
      where: { documentId: doc.id },
      include: { entity: { include: { entityType: true } } },
    });
    expect(savedEntities).toHaveLength(1);
    expect(savedEntities[0].entity.name).toBe('Bob Smith');
    expect(savedEntities[0].entity.entityType.name).toBe('person');

    const savedFacts = await prisma.documentFact.findMany({
      where: { documentId: doc.id },
      include: { fact: { include: { factType: true } } },
    });
    expect(savedFacts).toHaveLength(1);
    expect(savedFacts[0].fact.value).toBe('EUR 50,000');
    expect(savedFacts[0].fact.factType.name).toBe('monetary_amount');
  });

  it('persists deduplicated entities using canonical names', async () => {
    await prisma.entityType.create({
      data: { name: 'person', description: 'A person', prompt: 'Extract names.' },
    });

    const doc = await prisma.document.create({
      data: {
        id: 'doc-dedup-1',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        filePath: '/tmp/test.pdf',
        status: 'processing',
      },
    });

    const entities: DedupedEntity[] = [
      { typeName: 'person', name: 'John Doe', mergedFrom: ['John Doe', 'J. Doe'] },
    ];

    await persistResults(prisma, doc.id, entities, []);

    const saved = await prisma.documentEntity.findMany({
      where: { documentId: doc.id },
      include: { entity: true },
    });

    expect(saved).toHaveLength(1);
    expect(saved[0].entity.name).toBe('John Doe');
  });

  it('persists duplicate facts without deduplication', async () => {
    await prisma.factType.create({
      data: { name: 'monetary_amount', description: 'A monetary value', prompt: 'Extract monetary values.' },
    });

    const doc = await prisma.document.create({
      data: {
        id: 'doc-dup-facts',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        filePath: '/tmp/test.pdf',
        status: 'processing',
      },
    });

    const facts: ExtractedFact[] = [
      { typeName: 'monetary_amount', value: 'EUR 50,000' },
      { typeName: 'monetary_amount', value: 'EUR 50,000' },
    ];

    await persistResults(prisma, doc.id, [], facts);

    const savedFacts = await prisma.documentFact.findMany({
      where: { documentId: doc.id },
      include: { fact: { include: { factType: true } } },
    });
    expect(savedFacts).toHaveLength(2);
    expect(savedFacts[0].fact.value).toBe('EUR 50,000');
    expect(savedFacts[1].fact.value).toBe('EUR 50,000');
    expect(savedFacts[0].fact.factType.name).toBe('monetary_amount');
    expect(savedFacts[1].fact.factType.name).toBe('monetary_amount');
    // Each fact should have a different ID (not deduplicated)
    expect(savedFacts[0].fact.id).not.toBe(savedFacts[1].fact.id);
  });

  it('skips entities with unknown type names', async () => {
    await prisma.entityType.create({
      data: { name: 'person', description: 'A named individual', prompt: 'Extract full names.' },
    });

    const doc = await prisma.document.create({
      data: {
        id: 'doc-persist-2',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        filePath: '/tmp/test.pdf',
        status: 'processing',
      },
    });

    const entities: ExtractedEntity[] = [
      { typeName: 'unknown_type', name: 'Something' },
    ];

    await persistResults(prisma, doc.id, entities, []);

    const savedEntities = await prisma.documentEntity.findMany({
      where: { documentId: doc.id },
    });
    expect(savedEntities).toHaveLength(0);
  });
});
