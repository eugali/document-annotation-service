import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../../src/prisma/prisma.service';
import { DocumentsModule } from '../../src/documents/documents.module';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAME } from '../../src/config/constants';

// Use require for supertest CJS interop
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('Documents E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DocumentsModule],
    })
      .overrideProvider(getQueueToken(QUEUE_NAME))
      .useValue({ add: jest.fn().mockResolvedValue(undefined) })
      .compile();

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
    await prisma.entity.deleteMany();
    await prisma.fact.deleteMany();
    await prisma.document.deleteMany();
  });

  it('rejects unsupported file type with 400', async () => {
    const txtFile = path.join(__dirname, '../fixtures/sample.txt');
    fs.mkdirSync(path.dirname(txtFile), { recursive: true });
    fs.writeFileSync(txtFile, 'plain text content');

    await request(app.getHttpServer())
      .post('/documents')
      .attach('file', txtFile)
      .expect(400);
  });

  it('accepts PDF upload and returns 202 with id', async () => {
    const pdfFile = path.join(__dirname, '../fixtures/sample.pdf');

    const response = await request(app.getHttpServer())
      .post('/documents')
      .attach('file', pdfFile)
      .expect(202);

    expect(response.body.id).toBeDefined();

    const doc = await prisma.document.findUnique({
      where: { id: response.body.id },
    });
    expect(doc!.status).toBe('pending');
  });

  it('returns 202 for pending document annotations', async () => {
    const doc = await prisma.document.create({
      data: {
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        filePath: '/tmp/test.pdf',
        status: 'pending',
      },
    });

    await request(app.getHttpServer())
      .get(`/documents/${doc.id}/annotations`)
      .expect(202);
  });

  it('returns 404 for non-existent document', async () => {
    await request(app.getHttpServer())
      .get('/documents/non-existent-id/annotations')
      .expect(404);
  });

  it('returns full annotations for completed document', async () => {
    const entityType = await prisma.entityType.create({
      data: { name: 'person_e2e', description: 'A named individual', prompt: 'Extract full names.' },
    });

    const doc = await prisma.document.create({
      data: {
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        filePath: '/tmp/test.pdf',
        status: 'done',
      },
    });

    const entity = await prisma.entity.create({
      data: {
        entityTypeId: entityType.id,
        name: 'Bob Smith',
      },
    });

    await prisma.documentEntity.create({
      data: {
        documentId: doc.id,
        entityId: entity.id,
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/documents/${doc.id}/annotations`)
      .expect(200);

    expect(response.body.status).toBe('done');
    expect(response.body.entities.person_e2e).toHaveLength(1);
    expect(response.body.entities.person_e2e[0]).toBe('Bob Smith');
  });

  it('returns error for failed document', async () => {
    const doc = await prisma.document.create({
      data: {
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        filePath: '/tmp/test.pdf',
        status: 'failed',
        error: 'OpenAI rate limit exceeded',
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/documents/${doc.id}/annotations`)
      .expect(200);

    expect(response.body.status).toBe('failed');
    expect(response.body.error).toBe('OpenAI rate limit exceeded');
  });
});
