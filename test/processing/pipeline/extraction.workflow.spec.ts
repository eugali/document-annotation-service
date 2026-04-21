import { Test, TestingModule } from '@nestjs/testing';
import { ExtractionWorkflow } from '../../../src/processing/pipeline/extraction.workflow';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { CatalogService } from '../../../src/catalog/catalog.service';

jest.mock('../../../src/processing/pipeline/steps/parse-document.step');
jest.mock('../../../src/processing/pipeline/steps/chunk-document.step');
jest.mock('../../../src/processing/pipeline/steps/extract-entities.step');
jest.mock('../../../src/processing/pipeline/steps/extract-facts.step');
jest.mock('../../../src/processing/pipeline/steps/dedup-entities.step');
jest.mock('../../../src/processing/pipeline/steps/link-facts-to-entities.step');
jest.mock('../../../src/processing/pipeline/steps/persist-results.step');

import { parseDocument } from '../../../src/processing/pipeline/steps/parse-document.step';
import { chunkDocument } from '../../../src/processing/pipeline/steps/chunk-document.step';
import { extractEntityType } from '../../../src/processing/pipeline/steps/extract-entities.step';
import { extractFactType } from '../../../src/processing/pipeline/steps/extract-facts.step';
import { deduplicateEntities } from '../../../src/processing/pipeline/steps/dedup-entities.step';
import { linkFactsToEntities } from '../../../src/processing/pipeline/steps/link-facts-to-entities.step';
import { persistResults } from '../../../src/processing/pipeline/steps/persist-results.step';

describe('ExtractionWorkflow', () => {
  let workflow: ExtractionWorkflow;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExtractionWorkflow,
        PrismaService,
        {
          provide: CatalogService,
          useValue: {
            getEntityTypes: jest.fn().mockResolvedValue([
              {
                name: 'person',
                description: 'A person',
                prompt: 'Extract full names of individuals.',
              },
            ]),
            getFactTypes: jest.fn().mockResolvedValue([
              {
                name: 'monetary_amount',
                description: 'Money',
                prompt: 'Extract explicit monetary values.',
                entityLinkHint: 'Link to the person or organisation the amount relates to.',
              },
            ]),
          },
        },
      ],
    }).compile();

    workflow = module.get<ExtractionWorkflow>(ExtractionWorkflow);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    await prisma.document.deleteMany();
    jest.clearAllMocks();
  });

  it('runs fan-out/fan-in: parse -> chunk -> extract -> dedup -> persist', async () => {
    const doc = await prisma.document.create({
      data: {
        id: 'wf-doc-1',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        filePath: '/tmp/test.pdf',
        status: 'processing',
      },
    });

    const mockParsed = { type: 'pdf' as const, fullText: 'test content' };
    const mockChunks = [
      {
        chunkIndex: 0,
        totalChunks: 1,
        documentId: 'wf-doc-1',
        text: 'test content',
      },
    ];
    const mockEntities = [{ typeName: 'person', name: 'Bob', sourceSnippet: 'Bob paid $100', chunkIndex: 0 }];
    const mockFacts = [{ typeName: 'monetary_amount', value: '$100', sourceSnippet: 'Bob paid $100' }];
    const mockDeduped = [
      { typeName: 'person', name: 'Bob', mergedFrom: ['Bob'], sources: [{ snippet: 'Bob paid $100', chunkIndex: 0 }] },
    ];
    const mockLinks = [{ factIndex: 0, entityNames: ['Bob'], entityTypes: ['person'] }];

    (parseDocument as jest.Mock).mockResolvedValue(mockParsed);
    (chunkDocument as jest.Mock).mockReturnValue(mockChunks);
    (extractEntityType as jest.Mock).mockResolvedValue(mockEntities);
    (extractFactType as jest.Mock).mockResolvedValue(mockFacts);
    (deduplicateEntities as jest.Mock).mockResolvedValue(mockDeduped);
    (linkFactsToEntities as jest.Mock).mockResolvedValue(mockLinks);
    (persistResults as jest.Mock).mockResolvedValue(undefined);

    await workflow.run(doc.id);

    expect(parseDocument).toHaveBeenCalledWith(
      '/tmp/test.pdf',
      'application/pdf',
    );
    expect(chunkDocument).toHaveBeenCalledWith('test content', 'wf-doc-1');
    expect(extractEntityType).toHaveBeenCalledWith('test content', {
      name: 'person',
      prompt: 'Extract full names of individuals.',
    }, 0);
    expect(extractFactType).toHaveBeenCalledWith('test content', {
      name: 'monetary_amount',
      prompt: 'Extract explicit monetary values.',
    });
    expect(deduplicateEntities).toHaveBeenCalledWith(mockEntities);
    expect(linkFactsToEntities).toHaveBeenCalledWith(
      mockFacts,
      mockDeduped,
      { monetary_amount: 'Link to the person or organisation the amount relates to.' },
    );
    expect(persistResults).toHaveBeenCalledWith(
      expect.anything(),
      'wf-doc-1',
      mockDeduped,
      mockFacts,
      mockLinks,
    );
  });

  it('sets status to partial when an extraction task fails', async () => {
    const doc = await prisma.document.create({
      data: {
        id: 'wf-doc-partial',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        filePath: '/tmp/test.pdf',
        status: 'processing',
      },
    });

    const mockParsed = { type: 'pdf' as const, fullText: 'test content' };
    const mockChunks = [
      {
        chunkIndex: 0,
        totalChunks: 2,
        documentId: 'wf-doc-partial',
        text: 'chunk zero',
      },
      {
        chunkIndex: 1,
        totalChunks: 2,
        documentId: 'wf-doc-partial',
        text: 'chunk one',
      },
    ];
    const mockEntities = [{ typeName: 'person', name: 'Alice', sourceSnippet: 'Alice spent $200', chunkIndex: 0 }];
    const mockFacts = [{ typeName: 'monetary_amount', value: '$200', sourceSnippet: 'Alice spent $200' }];
    const mockDeduped = [
      { typeName: 'person', name: 'Alice', mergedFrom: ['Alice'], sources: [{ snippet: 'Alice spent $200', chunkIndex: 0 }] },
    ];
    const mockLinks = [{ factIndex: 0, entityNames: ['Alice'], entityTypes: ['person'] }];

    (parseDocument as jest.Mock).mockResolvedValue(mockParsed);
    (chunkDocument as jest.Mock).mockReturnValue(mockChunks);

    // First entity extraction succeeds, second fails
    (extractEntityType as jest.Mock)
      .mockResolvedValueOnce(mockEntities)
      .mockRejectedValueOnce(new Error('OpenAI timeout'));

    // Both fact extractions succeed
    (extractFactType as jest.Mock).mockResolvedValue(mockFacts);

    (deduplicateEntities as jest.Mock).mockResolvedValue(mockDeduped);
    (linkFactsToEntities as jest.Mock).mockResolvedValue(mockLinks);

    // persistResults must call through to the real prisma to check status,
    // but we mock it since the workflow mocks all steps
    (persistResults as jest.Mock).mockResolvedValue(undefined);

    await workflow.run(doc.id);

    // Verify persistResults was still called with the successful results
    expect(persistResults).toHaveBeenCalledWith(
      expect.anything(),
      'wf-doc-partial',
      mockDeduped,
      expect.arrayContaining([
        expect.objectContaining({ typeName: 'monetary_amount', value: '$200' }),
      ]),
      mockLinks,
    );

    // Verify the document status was set to partial
    const updatedDoc = await prisma.document.findUnique({
      where: { id: 'wf-doc-partial' },
    });
    expect(updatedDoc!.status).toBe('partial');
    expect(updatedDoc!.error).toContain('chunk');
    expect(updatedDoc!.error).toContain('person');
  });
});
