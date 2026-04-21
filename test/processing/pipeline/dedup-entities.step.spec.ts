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
      { typeName: 'person', name: 'John Doe' },
      { typeName: 'person', name: 'J. Doe' },
      { typeName: 'organization', name: 'Acme Corp' },
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
    expect(result[1].name).toBe('Acme Corp');
  });

  it('returns entities unchanged when no duplicates', async () => {
    const entities: ExtractedEntity[] = [
      { typeName: 'person', name: 'Alice' },
      { typeName: 'location', name: 'New York' },
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
  });

  it('does not merge entities of different types with same name', async () => {
    const entities: ExtractedEntity[] = [
      { typeName: 'person', name: 'Washington' },
      { typeName: 'location', name: 'Washington' },
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
  });

  it('falls back to raw entities when LLM call fails', async () => {
    jest.useFakeTimers();

    const entities: ExtractedEntity[] = [
      { typeName: 'person', name: 'Bob' },
      { typeName: 'person', name: 'Bob' },
    ];

    mockCreate.mockRejectedValue(new Error('API down'));

    const resultPromise = deduplicateEntities(entities);

    // Advance past all retry backoff delays (2s + 4s + 8s)
    await jest.advanceTimersByTimeAsync(15_000);

    const result = await resultPromise;
    expect(result).toHaveLength(2);
    expect(result[0].mergedFrom).toEqual(['Bob']);

    jest.useRealTimers();
  });

  it('uses json_schema structured output', async () => {
    const entities: ExtractedEntity[] = [
      { typeName: 'person', name: 'Alice' },
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
});
