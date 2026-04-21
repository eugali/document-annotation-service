import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');
import { CatalogModule } from '../../src/catalog/catalog.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('CatalogController', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CatalogModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.documentEntity.deleteMany();
    await prisma.documentFact.deleteMany();
    await prisma.factEntity.deleteMany();
    await prisma.entitySource.deleteMany();
    await prisma.entity.deleteMany();
    await prisma.fact.deleteMany();
    await prisma.entityType.deleteMany();
    await prisma.factType.deleteMany();

    await prisma.entityType.create({
      data: { id: 'et-1', name: 'person', description: 'A person', prompt: 'Extract people.' },
    });
    await prisma.factType.create({
      data: { id: 'ft-1', name: 'monetary_amount', description: 'Money', prompt: 'Extract money.' },
    });
  });

  describe('GET /catalog', () => {
    it('returns both entity types and fact types', async () => {
      const response = await request(app.getHttpServer())
        .get('/catalog')
        .expect(200);

      expect(response.body.entityTypes).toHaveLength(1);
      expect(response.body.entityTypes[0]).toMatchObject({
        id: 'et-1',
        name: 'person',
        description: 'A person',
        prompt: 'Extract people.',
      });
      expect(response.body.factTypes).toHaveLength(1);
      expect(response.body.factTypes[0]).toMatchObject({
        id: 'ft-1',
        name: 'monetary_amount',
      });
    });
  });

  describe('PUT /catalog/entity-types/:id', () => {
    it('updates description and prompt', async () => {
      const response = await request(app.getHttpServer())
        .put('/catalog/entity-types/et-1')
        .send({ description: 'Updated desc', prompt: 'Updated prompt' })
        .expect(200);

      expect(response.body.description).toBe('Updated desc');
      expect(response.body.prompt).toBe('Updated prompt');

      const record = await prisma.entityType.findUnique({ where: { id: 'et-1' } });
      expect(record!.description).toBe('Updated desc');
    });

    it('returns 404 for non-existent id', async () => {
      await request(app.getHttpServer())
        .put('/catalog/entity-types/nonexistent')
        .send({ description: 'x', prompt: 'y' })
        .expect(404);
    });
  });

  describe('PUT /catalog/fact-types/:id', () => {
    it('updates description and prompt', async () => {
      const response = await request(app.getHttpServer())
        .put('/catalog/fact-types/ft-1')
        .send({ description: 'New money desc', prompt: 'New money prompt' })
        .expect(200);

      expect(response.body.description).toBe('New money desc');
    });

    it('returns 404 for non-existent id', async () => {
      await request(app.getHttpServer())
        .put('/catalog/fact-types/nonexistent')
        .send({ description: 'x', prompt: 'y' })
        .expect(404);
    });
  });

  describe('POST /catalog/entity-types', () => {
    it('creates a new entity type', async () => {
      const response = await request(app.getHttpServer())
        .post('/catalog/entity-types')
        .send({ name: 'vehicle', description: 'A vehicle', prompt: 'Extract vehicles.' })
        .expect(201);
      expect(response.body).toMatchObject({ name: 'vehicle', description: 'A vehicle', prompt: 'Extract vehicles.' });
      expect(response.body.id).toBeDefined();
    });

    it('rejects duplicate name with 409', async () => {
      await request(app.getHttpServer())
        .post('/catalog/entity-types')
        .send({ name: 'person', description: 'dup', prompt: 'dup' })
        .expect(409);
    });

    it('rejects missing fields with 400', async () => {
      await request(app.getHttpServer())
        .post('/catalog/entity-types')
        .send({ name: 'incomplete' })
        .expect(400);
    });
  });

  describe('DELETE /catalog/entity-types/:id', () => {
    it('deletes entity type and cascades', async () => {
      await request(app.getHttpServer())
        .delete('/catalog/entity-types/et-1')
        .expect(204);
      const remaining = await prisma.entityType.findUnique({ where: { id: 'et-1' } });
      expect(remaining).toBeNull();
    });

    it('returns 404 for non-existent id', async () => {
      await request(app.getHttpServer())
        .delete('/catalog/entity-types/nonexistent')
        .expect(404);
    });
  });

  describe('POST /catalog/fact-types', () => {
    it('creates with entityLinkHint', async () => {
      const response = await request(app.getHttpServer())
        .post('/catalog/fact-types')
        .send({ name: 'salary', description: 'Salary', prompt: 'Extract salaries.', entityLinkHint: 'often related to person' })
        .expect(201);
      expect(response.body.entityLinkHint).toBe('often related to person');
    });

    it('creates without entityLinkHint', async () => {
      const response = await request(app.getHttpServer())
        .post('/catalog/fact-types')
        .send({ name: 'gdp', description: 'GDP', prompt: 'Extract GDP.' })
        .expect(201);
      expect(response.body.entityLinkHint).toBeNull();
    });
  });

  describe('DELETE /catalog/fact-types/:id', () => {
    it('deletes fact type', async () => {
      await request(app.getHttpServer())
        .delete('/catalog/fact-types/ft-1')
        .expect(204);
      const remaining = await prisma.factType.findUnique({ where: { id: 'ft-1' } });
      expect(remaining).toBeNull();
    });
  });
});
