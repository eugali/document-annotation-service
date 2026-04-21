import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ProcessingProcessor } from '../../src/processing/processing.processor';
import { Job } from 'bullmq';

describe('ProcessingProcessor', () => {
  let processor: ProcessingProcessor;
  let prisma: PrismaService;

  const mockPipeline = { run: jest.fn().mockResolvedValue(undefined) };
  const mockWebhookService = { notify: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();

    // Create processor manually, bypassing @Processor decorator BullMQ wiring
    processor = new ProcessingProcessor(
      prisma,
      mockPipeline as any,
      mockWebhookService as any,
    );
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    await prisma.document.deleteMany();
    jest.clearAllMocks();
    mockPipeline.run.mockResolvedValue(undefined);
  });

  it('transitions document from pending to done on success', async () => {
    const doc = await prisma.document.create({
      data: {
        id: 'test-doc-1',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        filePath: '/tmp/test.pdf',
        status: 'pending',
      },
    });

    const job = { data: { documentId: doc.id } } as Job;
    await processor.process(job);

    const updated = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(updated!.status).toBe('done');
  });

  it('transitions document to failed on pipeline error', async () => {
    const doc = await prisma.document.create({
      data: {
        id: 'test-doc-2',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        filePath: '/tmp/test.pdf',
        status: 'pending',
      },
    });

    mockPipeline.run.mockRejectedValueOnce(new Error('LLM timeout'));

    const job = { data: { documentId: doc.id } } as Job;

    await expect(processor.process(job)).rejects.toThrow('LLM timeout');

    const updated = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(updated!.status).toBe('failed');
    expect(updated!.error).toBe('LLM timeout');
  });
});
