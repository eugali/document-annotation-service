import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');
import { ExtractionsModule } from '../../src/extractions/extractions.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('ExtractionsController', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ExtractionsModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
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

  describe('GET /extractions', () => {
    it('returns empty arrays when no extractions exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/extractions')
        .expect(200);

      expect(response.body).toEqual({ entities: [], facts: [], documents: [] });
    });

    it('returns entities grouped by type with document links', async () => {
      const et = await prisma.entityType.create({
        data: { name: 'person', description: 'A person', prompt: 'p' },
      });
      const doc = await prisma.document.create({
        data: {
          id: 'doc-ext-1',
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          filePath: '/tmp/t.pdf',
          status: 'done',
        },
      });
      const entity = await prisma.entity.create({
        data: { name: 'John Doe', entityTypeId: et.id },
      });
      await prisma.documentEntity.create({
        data: { documentId: doc.id, entityId: entity.id },
      });

      const response = await request(app.getHttpServer())
        .get('/extractions')
        .expect(200);

      expect(response.body.entities).toHaveLength(1);
      expect(response.body.entities[0].type).toBe('person');
      expect(response.body.entities[0].items).toHaveLength(1);
      expect(response.body.entities[0].items[0].name).toBe('John Doe');
      expect(response.body.entities[0].items[0].documents).toEqual([
        { id: 'doc-ext-1', filename: 'test.pdf' },
      ]);
      expect(response.body.entities[0].items[0].sources).toEqual([]);
      expect(response.body.entities[0].items[0].linkedFactIds).toEqual([]);
    });

    it('returns facts grouped by type with document links', async () => {
      const ft = await prisma.factType.create({
        data: { name: 'monetary_amount', description: 'Money', prompt: 'p' },
      });
      const doc = await prisma.document.create({
        data: {
          id: 'doc-ext-2',
          filename: 'invoice.pdf',
          mimeType: 'application/pdf',
          filePath: '/tmp/i.pdf',
          status: 'done',
        },
      });
      const fact = await prisma.fact.create({
        data: { value: '50000 EUR', factTypeId: ft.id },
      });
      await prisma.documentFact.create({
        data: { documentId: doc.id, factId: fact.id },
      });

      const response = await request(app.getHttpServer())
        .get('/extractions')
        .expect(200);

      expect(response.body.facts).toHaveLength(1);
      expect(response.body.facts[0].type).toBe('monetary_amount');
      expect(response.body.facts[0].items[0].value).toBe('50000 EUR');
      expect(response.body.facts[0].items[0].documents).toEqual([
        { id: 'doc-ext-2', filename: 'invoice.pdf' },
      ]);
      expect(response.body.facts[0].items[0].sourceSnippet).toBe('');
      expect(response.body.facts[0].items[0].sourcePage).toBeNull();
      expect(response.body.facts[0].items[0].sourceCell).toBeNull();
      expect(response.body.facts[0].items[0].linkedEntities).toEqual([]);
    });

    it('returns enriched entity data with sources and linked fact IDs', async () => {
      const et = await prisma.entityType.create({
        data: { name: 'person', description: 'A person', prompt: 'p' },
      });
      const ft = await prisma.factType.create({
        data: {
          name: 'monetary_amount',
          description: 'Money',
          prompt: 'p',
        },
      });
      const doc = await prisma.document.create({
        data: {
          id: 'doc-enrich-1',
          filename: 'contract.pdf',
          mimeType: 'application/pdf',
          filePath: '/tmp/c.pdf',
          status: 'done',
        },
      });
      const entity = await prisma.entity.create({
        data: { name: 'John Doe', entityTypeId: et.id },
      });
      await prisma.documentEntity.create({
        data: { documentId: doc.id, entityId: entity.id },
      });
      await prisma.entitySource.create({
        data: {
          entityId: entity.id,
          snippet: 'John Doe on page 2',
          page: 2,
          chunkIndex: 0,
        },
      });

      const fact = await prisma.fact.create({
        data: {
          factTypeId: ft.id,
          value: '$150,000',
          sourceSnippet: "John Doe's salary is $150,000",
          sourcePage: 5,
        },
      });
      await prisma.documentFact.create({
        data: { documentId: doc.id, factId: fact.id },
      });
      await prisma.factEntity.create({
        data: { factId: fact.id, entityId: entity.id },
      });

      const response = await request(app.getHttpServer())
        .get('/extractions')
        .expect(200);

      // Entities include sources and linkedFactIds
      expect(response.body.entities[0].items[0].sources).toEqual([
        expect.objectContaining({
          snippet: 'John Doe on page 2',
          page: 2,
          chunkIndex: 0,
        }),
      ]);
      expect(response.body.entities[0].items[0].linkedFactIds).toContain(
        fact.id,
      );

      // Facts include source fields and linkedEntities
      expect(response.body.facts[0].items[0].sourceSnippet).toBe(
        "John Doe's salary is $150,000",
      );
      expect(response.body.facts[0].items[0].sourcePage).toBe(5);
      expect(response.body.facts[0].items[0].linkedEntities).toEqual([
        expect.objectContaining({ id: entity.id, name: 'John Doe' }),
      ]);

      // Documents top-level
      expect(response.body.documents).toEqual([
        expect.objectContaining({
          id: 'doc-enrich-1',
          filename: 'contract.pdf',
          status: 'done',
        }),
      ]);
    });
  });
});
