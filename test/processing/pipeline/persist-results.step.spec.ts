import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { persistResults } from '../../../src/processing/pipeline/steps/persist-results.step';
import {
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
    await prisma.factEntity.deleteMany();
    await prisma.entitySource.deleteMany();
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

    const entities: DedupedEntity[] = [
      { typeName: 'person', name: 'Bob Smith', mergedFrom: ['Bob Smith'], sources: [{ snippet: 'Bob Smith', chunkIndex: 0 }] },
    ];

    const facts: ExtractedFact[] = [
      { typeName: 'monetary_amount', value: 'EUR 50,000', sourceSnippet: 'EUR 50,000' },
    ];

    await persistResults(prisma, doc.id, entities, facts, []);

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
      { typeName: 'person', name: 'John Doe', mergedFrom: ['John Doe', 'J. Doe'], sources: [{ snippet: 'John Doe', chunkIndex: 0 }] },
    ];

    await persistResults(prisma, doc.id, entities, [], []);

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
      { typeName: 'monetary_amount', value: 'EUR 50,000', sourceSnippet: 'EUR 50,000' },
      { typeName: 'monetary_amount', value: 'EUR 50,000', sourceSnippet: 'EUR 50,000' },
    ];

    await persistResults(prisma, doc.id, [], facts, []);

    const savedFacts = await prisma.documentFact.findMany({
      where: { documentId: doc.id },
      include: { fact: { include: { factType: true } } },
    });
    expect(savedFacts).toHaveLength(2);
    expect(savedFacts[0].fact.value).toBe('EUR 50,000');
    expect(savedFacts[1].fact.value).toBe('EUR 50,000');
    expect(savedFacts[0].fact.factType.name).toBe('monetary_amount');
    expect(savedFacts[1].fact.factType.name).toBe('monetary_amount');
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

    const entities: DedupedEntity[] = [
      { typeName: 'unknown_type', name: 'Something', mergedFrom: ['Something'], sources: [{ snippet: 'Something', chunkIndex: 0 }] },
    ];

    await persistResults(prisma, doc.id, entities, [], []);

    const savedEntities = await prisma.documentEntity.findMany({
      where: { documentId: doc.id },
    });
    expect(savedEntities).toHaveLength(0);
  });

  it('reuses existing entity when (entityTypeId, name) matches', async () => {
    const et = await prisma.entityType.create({
      data: { name: 'person', description: 'A person', prompt: 'Extract.' },
    });
    const existingEntity = await prisma.entity.create({
      data: { entityTypeId: et.id, name: 'Bob Smith' },
    });
    const doc1 = await prisma.document.create({
      data: { id: 'doc-upsert-1', filename: 'a.pdf', mimeType: 'application/pdf', filePath: '/tmp/a.pdf', status: 'processing' },
    });
    await prisma.documentEntity.create({
      data: { documentId: doc1.id, entityId: existingEntity.id },
    });

    const doc2 = await prisma.document.create({
      data: { id: 'doc-upsert-2', filename: 'b.pdf', mimeType: 'application/pdf', filePath: '/tmp/b.pdf', status: 'processing' },
    });

    const entities: DedupedEntity[] = [
      { typeName: 'person', name: 'Bob Smith', mergedFrom: ['Bob Smith'], sources: [{ snippet: 'Bob Smith in doc B', page: 1, chunkIndex: 0 }] },
    ];

    await persistResults(prisma, doc2.id, entities, [], []);

    const allEntities = await prisma.entity.findMany({ where: { name: 'Bob Smith' } });
    expect(allEntities).toHaveLength(1);
    expect(allEntities[0].id).toBe(existingEntity.id);

    const links = await prisma.documentEntity.findMany({ where: { entityId: existingEntity.id } });
    expect(links).toHaveLength(2);
  });

  it('creates EntitySource records for each entity source', async () => {
    await prisma.entityType.create({
      data: { name: 'person', description: 'A person', prompt: 'Extract.' },
    });
    const doc = await prisma.document.create({
      data: { id: 'doc-sources', filename: 'a.pdf', mimeType: 'application/pdf', filePath: '/tmp/a.pdf', status: 'processing' },
    });

    const entities: DedupedEntity[] = [{
      typeName: 'person', name: 'John Doe', mergedFrom: ['John Doe', 'J. Doe'],
      sources: [
        { snippet: 'John Doe on page 2', page: 2, chunkIndex: 0 },
        { snippet: 'J. Doe signed on page 17', page: 17, chunkIndex: 3 },
      ],
    }];

    await persistResults(prisma, doc.id, entities, [], []);

    const entity = await prisma.entity.findFirst({ where: { name: 'John Doe' } });
    const sources = await prisma.entitySource.findMany({ where: { entityId: entity!.id } });
    expect(sources).toHaveLength(2);
    expect(sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ snippet: 'John Doe on page 2', page: 2, chunkIndex: 0 }),
      expect.objectContaining({ snippet: 'J. Doe signed on page 17', page: 17, chunkIndex: 3 }),
    ]));
  });

  it('saves sourceSnippet, sourcePage, sourceCell on facts', async () => {
    await prisma.factType.create({
      data: { name: 'monetary_amount', description: 'Money', prompt: 'Extract.' },
    });
    const doc = await prisma.document.create({
      data: { id: 'doc-fact-src', filename: 'a.pdf', mimeType: 'application/pdf', filePath: '/tmp/a.pdf', status: 'processing' },
    });

    const facts: ExtractedFact[] = [
      { typeName: 'monetary_amount', value: 'EUR 50,000', sourceSnippet: 'The salary is EUR 50,000', sourcePage: 3, sourceCell: undefined },
    ];

    await persistResults(prisma, doc.id, [], facts, []);

    const savedFact = await prisma.fact.findFirst();
    expect(savedFact!.sourceSnippet).toBe('The salary is EUR 50,000');
    expect(savedFact!.sourcePage).toBe(3);
    expect(savedFact!.sourceCell).toBeNull();
  });

  it('creates FactEntity records from linking results', async () => {
    await prisma.entityType.create({
      data: { name: 'person', description: 'A person', prompt: 'Extract.' },
    });
    await prisma.factType.create({
      data: { name: 'monetary_amount', description: 'Money', prompt: 'Extract.' },
    });
    const doc = await prisma.document.create({
      data: { id: 'doc-link', filename: 'a.pdf', mimeType: 'application/pdf', filePath: '/tmp/a.pdf', status: 'processing' },
    });

    const entities: DedupedEntity[] = [
      { typeName: 'person', name: 'Bob', mergedFrom: ['Bob'], sources: [{ snippet: 'Bob', chunkIndex: 0 }] },
    ];
    const facts: ExtractedFact[] = [
      { typeName: 'monetary_amount', value: '$100', sourceSnippet: "Bob's salary is $100" },
    ];
    const links = [{ factIndex: 0, entityNames: ['Bob'], entityTypes: ['person'] }];

    await persistResults(prisma, doc.id, entities, facts, links);

    const factEntity = await prisma.factEntity.findMany();
    expect(factEntity).toHaveLength(1);

    const fact = await prisma.fact.findFirst();
    const entity = await prisma.entity.findFirst();
    expect(factEntity[0].factId).toBe(fact!.id);
    expect(factEntity[0].entityId).toBe(entity!.id);
  });
});
