import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');
import * as path from 'path';
import * as fs from 'fs';
import { DocumentsModule } from '../../src/documents/documents.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAME } from '../../src/config/constants';

describe('DocumentsController', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DocumentsModule],
    })
      .overrideProvider(getQueueToken(QUEUE_NAME))
      .useValue({ add: jest.fn().mockResolvedValue({ id: '1' }) })
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
    await prisma.document.deleteMany();
  });

  describe('POST /documents', () => {
    it('returns 202 with document id for valid PDF', async () => {
      const testPdf = path.join(__dirname, '../fixtures/sample.pdf');
      fs.mkdirSync(path.dirname(testPdf), { recursive: true });
      fs.writeFileSync(testPdf, '%PDF-1.4 fake pdf content');

      const response = await request(app.getHttpServer())
        .post('/documents')
        .attach('file', testPdf)
        .expect(202);

      expect(response.body).toHaveProperty('id');
      expect(typeof response.body.id).toBe('string');

      const doc = await prisma.document.findUnique({
        where: { id: response.body.id },
      });
      expect(doc).not.toBeNull();
      expect(doc!.status).toBe('pending');
      expect(doc!.mimeType).toBe('application/pdf');
    });

    it('returns 400 for unsupported file type', async () => {
      const testTxt = path.join(__dirname, '../fixtures/sample.txt');
      fs.writeFileSync(testTxt, 'plain text');

      const response = await request(app.getHttpServer())
        .post('/documents')
        .attach('file', testTxt)
        .expect(400);

      expect(response.body.message).toContain('Unsupported file type');
    });

    it('returns 400 when no file attached', async () => {
      const response = await request(app.getHttpServer())
        .post('/documents')
        .expect(400);

      expect(response.body.message).toContain('File is required');
    });

    it('returns 202 for .docx file upload', async () => {
      const testDocx = path.join(__dirname, '../fixtures/sample.docx');
      fs.mkdirSync(path.dirname(testDocx), { recursive: true });
      fs.writeFileSync(testDocx, 'PK fake docx content');

      const response = await request(app.getHttpServer())
        .post('/documents')
        .attach('file', testDocx)
        .expect(202);

      expect(response.body).toHaveProperty('id');
      const doc = await prisma.document.findUnique({
        where: { id: response.body.id },
      });
      expect(doc).not.toBeNull();
      expect(doc!.status).toBe('pending');
    });

    it('returns 202 for .csv file upload', async () => {
      const testCsv = path.join(__dirname, '../fixtures/sample.csv');
      fs.mkdirSync(path.dirname(testCsv), { recursive: true });
      fs.writeFileSync(testCsv, 'name,age\nAlice,30\nBob,25');

      const response = await request(app.getHttpServer())
        .post('/documents')
        .attach('file', testCsv)
        .expect(202);

      expect(response.body).toHaveProperty('id');
      const doc = await prisma.document.findUnique({
        where: { id: response.body.id },
      });
      expect(doc).not.toBeNull();
      expect(doc!.status).toBe('pending');
    });

    it('returns 400 for .doc file upload', async () => {
      const testDoc = path.join(__dirname, '../fixtures/sample.doc');
      fs.mkdirSync(path.dirname(testDoc), { recursive: true });
      fs.writeFileSync(testDoc, 'legacy doc content');

      const response = await request(app.getHttpServer())
        .post('/documents')
        .attach('file', testDoc)
        .expect(400);

      expect(response.body.message).toContain('Unsupported file type');
    });

    it('stores jobId on the document after upload', async () => {
      const mockJobId = '42';
      const queueToken = getQueueToken(QUEUE_NAME);
      const queue = app.get(queueToken);
      (queue.add as jest.Mock).mockResolvedValueOnce({ id: mockJobId });

      const testPdf = path.join(__dirname, '../fixtures/sample.pdf');
      fs.mkdirSync(path.dirname(testPdf), { recursive: true });
      fs.writeFileSync(testPdf, '%PDF-1.4 fake pdf content');

      const response = await request(app.getHttpServer())
        .post('/documents')
        .attach('file', testPdf)
        .expect(202);

      const doc = await prisma.document.findUnique({
        where: { id: response.body.id },
      });
      expect(doc!.jobId).toBe(mockJobId);
    });
  });

  describe('GET /documents/:id/annotations', () => {
    it('returns 200 with partial status, entities, facts, and error', async () => {
      // Seed entity type + fact type
      await prisma.entityType.upsert({
        where: { name: 'person' },
        update: {},
        create: { name: 'person', description: 'A person', prompt: 'Extract names.' },
      });
      await prisma.factType.upsert({
        where: { name: 'monetary_amount' },
        update: {},
        create: { name: 'monetary_amount', description: 'Money', prompt: 'Extract money.' },
      });

      // Create a document with partial status
      const doc = await prisma.document.create({
        data: {
          id: 'partial-doc-1',
          filename: 'partial.pdf',
          mimeType: 'application/pdf',
          filePath: '/tmp/partial.pdf',
          status: 'partial',
          error: 'Extraction failed for chunk 1: person (entity)',
        },
      });

      // Seed an entity linked to the document
      const entityType = await prisma.entityType.findUnique({ where: { name: 'person' } });
      const entity = await prisma.entity.create({
        data: { name: 'Alice', entityTypeId: entityType!.id },
      });
      await prisma.documentEntity.create({
        data: { documentId: doc.id, entityId: entity.id },
      });

      // Seed a fact linked to the document
      const factType = await prisma.factType.findUnique({ where: { name: 'monetary_amount' } });
      const fact = await prisma.fact.create({
        data: { value: '$500', factTypeId: factType!.id },
      });
      await prisma.documentFact.create({
        data: { documentId: doc.id, factId: fact.id },
      });

      const response = await request(app.getHttpServer())
        .get(`/documents/${doc.id}/annotations`)
        .expect(200);

      expect(response.body.status).toBe('partial');
      expect(response.body.entities).toEqual({ person: ['Alice'] });
      expect(response.body.facts).toEqual({ monetary_amount: ['$500'] });
      expect(response.body.error).toContain('chunk 1');
    });
  });
});
