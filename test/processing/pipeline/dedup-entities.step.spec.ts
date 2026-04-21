import { deduplicateEntities } from '../../../src/processing/pipeline/steps/dedup-entities.step';
import { ExtractedEntity } from '../../../src/processing/pipeline/pipeline.types';

const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

describe('deduplicateEntities', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('merges duplicate entities across chunks', async () => {
    const entities: ExtractedEntity[] = [
      { typeName: 'person', name: 'John Doe', sourceSnippet: 'John Doe ref', sourcePage: 1, chunkIndex: 0 },
      { typeName: 'person', name: 'J. Doe', sourceSnippet: 'J. Doe ref', sourcePage: 5, chunkIndex: 2 },
      { typeName: 'organization', name: 'Acme Corp', sourceSnippet: 'Acme ref', sourcePage: 3, chunkIndex: 1 },
    ];

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              entities: [
                { typeName: 'person', name: 'John Doe', mergedFrom: ['John Doe', 'J. Doe'] },
                { typeName: 'organization', name: 'Acme Corp', mergedFrom: ['Acme Corp'] },
              ],
            }),
          },
        },
      ],
    });

    const result = await deduplicateEntities(entities);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('John Doe');
    expect(result[0].mergedFrom).toContain('J. Doe');
    expect(result[0].sources).toHaveLength(2);
    expect(result[1].name).toBe('Acme Corp');
    expect(result[1].sources).toHaveLength(1);
  });

  it('returns entities unchanged when no duplicates', async () => {
    const entities: ExtractedEntity[] = [
      { typeName: 'person', name: 'Alice', sourceSnippet: 'Alice ref', sourcePage: 1, chunkIndex: 0 },
      { typeName: 'location', name: 'New York', sourceSnippet: 'NY ref', sourcePage: 2, chunkIndex: 1 },
    ];

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              entities: [
                { typeName: 'person', name: 'Alice', mergedFrom: ['Alice'] },
                { typeName: 'location', name: 'New York', mergedFrom: ['New York'] },
              ],
            }),
          },
        },
      ],
    });

    const result = await deduplicateEntities(entities);
    expect(result).toHaveLength(2);
    expect(result[0].sources).toHaveLength(1);
    expect(result[1].sources).toHaveLength(1);
  });

  it('does not merge entities of different types with same name', async () => {
    const entities: ExtractedEntity[] = [
      { typeName: 'person', name: 'Washington', sourceSnippet: 'person Washington', sourcePage: 1, chunkIndex: 0 },
      { typeName: 'location', name: 'Washington', sourceSnippet: 'location Washington', sourcePage: 2, chunkIndex: 1 },
    ];

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              entities: [
                { typeName: 'person', name: 'Washington', mergedFrom: ['Washington'] },
                { typeName: 'location', name: 'Washington', mergedFrom: ['Washington'] },
              ],
            }),
          },
        },
      ],
    });

    const result = await deduplicateEntities(entities);
    expect(result).toHaveLength(2);
    expect(result.find((e) => e.typeName === 'person')).toBeDefined();
    expect(result.find((e) => e.typeName === 'location')).toBeDefined();
    expect(result.find((e) => e.typeName === 'person')?.sources).toHaveLength(1);
    expect(result.find((e) => e.typeName === 'location')?.sources).toHaveLength(1);
  });

  it('falls back to raw entities when LLM call fails', async () => {
    jest.useFakeTimers();

    const entities: ExtractedEntity[] = [
      { typeName: 'person', name: 'Bob', sourceSnippet: 'Bob ref 1', sourcePage: 1, chunkIndex: 0 },
      { typeName: 'person', name: 'Bob', sourceSnippet: 'Bob ref 2', sourcePage: 4, chunkIndex: 3 },
    ];

    mockCreate.mockRejectedValue(new Error('API down'));

    const resultPromise = deduplicateEntities(entities);

    // Advance past all retry backoff delays (2s + 4s + 8s)
    await jest.advanceTimersByTimeAsync(15_000);

    const result = await resultPromise;
    expect(result).toHaveLength(2);
    expect(result[0].mergedFrom).toEqual(['Bob']);
    expect(result[0].sources).toEqual([
      { snippet: 'Bob ref 1', page: 1, cell: undefined, chunkIndex: 0 },
    ]);
    expect(result[1].sources).toEqual([
      { snippet: 'Bob ref 2', page: 4, cell: undefined, chunkIndex: 3 },
    ]);

    jest.useRealTimers();
  });

  it('uses json_schema structured output', async () => {
    const entities: ExtractedEntity[] = [
      { typeName: 'person', name: 'Alice', sourceSnippet: 'Alice ref', sourcePage: 1, chunkIndex: 0 },
    ];

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              entities: [
                { typeName: 'person', name: 'Alice', mergedFrom: ['Alice'] },
              ],
            }),
          },
        },
      ],
    });

    await deduplicateEntities(entities);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: expect.objectContaining({
          type: 'json_schema',
        }),
      }),
    );
  });

  it('collects sources from all merged entities via mergedFrom', async () => {
    const entities: ExtractedEntity[] = [
      { typeName: 'person', name: 'John Doe', sourceSnippet: 'John Doe on page 2', sourcePage: 2, sourceCell: undefined, chunkIndex: 0 },
      { typeName: 'person', name: 'J. Doe', sourceSnippet: 'J. Doe signed on page 17', sourcePage: 17, sourceCell: undefined, chunkIndex: 3 },
      { typeName: 'organization', name: 'Acme Corp', sourceSnippet: 'Acme Corp HQ', sourcePage: 1, sourceCell: undefined, chunkIndex: 0 },
    ];

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              entities: [
                { typeName: 'person', name: 'John Doe', mergedFrom: ['John Doe', 'J. Doe'] },
                { typeName: 'organization', name: 'Acme Corp', mergedFrom: ['Acme Corp'] },
              ],
            }),
          },
        },
      ],
    });

    const result = await deduplicateEntities(entities);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('John Doe');
    expect(result[0].sources).toHaveLength(2);
    expect(result[0].sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ snippet: 'John Doe on page 2', page: 2, chunkIndex: 0 }),
        expect.objectContaining({ snippet: 'J. Doe signed on page 17', page: 17, chunkIndex: 3 }),
      ]),
    );
    expect(result[1].sources).toHaveLength(1);
  });

  it('includes sourceCell in sources for spreadsheet entities', async () => {
    const entities: ExtractedEntity[] = [
      { typeName: 'metric', name: 'Revenue', sourceSnippet: 'Revenue $1M', sourceCell: 'B2', chunkIndex: 0 },
      { typeName: 'metric', name: 'Rev.', sourceSnippet: 'Rev. $1M', sourceCell: 'C5', chunkIndex: 1 },
    ];

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              entities: [
                { typeName: 'metric', name: 'Revenue', mergedFrom: ['Revenue', 'Rev.'] },
              ],
            }),
          },
        },
      ],
    });

    const result = await deduplicateEntities(entities);

    expect(result).toHaveLength(1);
    expect(result[0].sources).toHaveLength(2);
    expect(result[0].sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ snippet: 'Revenue $1M', cell: 'B2', chunkIndex: 0 }),
        expect.objectContaining({ snippet: 'Rev. $1M', cell: 'C5', chunkIndex: 1 }),
      ]),
    );
  });
});
