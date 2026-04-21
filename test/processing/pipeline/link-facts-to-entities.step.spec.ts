import { linkFactsToEntities } from '../../../src/processing/pipeline/steps/link-facts-to-entities.step';
import { DedupedEntity, ExtractedFact } from '../../../src/processing/pipeline/pipeline.types';

const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

describe('linkFactsToEntities', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('links facts to entities using source snippets', async () => {
    const facts: ExtractedFact[] = [
      { typeName: 'monetary_amount', value: '$150,000', sourceSnippet: "John Doe's salary is $150,000", sourcePage: 5 },
    ];
    const entities: DedupedEntity[] = [
      { typeName: 'person', name: 'John Doe', mergedFrom: ['John Doe'], sources: [] },
      { typeName: 'person', name: 'Jane Smith', mergedFrom: ['Jane Smith'], sources: [] },
    ];
    const hints: Record<string, string> = { monetary_amount: 'often related to person or organization' };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ links: [{ factIndex: 0, entityNames: ['John Doe'], entityTypes: ['person'] }] }) } }],
    });

    const result = await linkFactsToEntities(facts, entities, hints);
    expect(result).toEqual([{ factIndex: 0, entityNames: ['John Doe'], entityTypes: ['person'] }]);
  });

  it('returns empty links when no facts provided', async () => {
    const result = await linkFactsToEntities([], [{ typeName: 'person', name: 'X', mergedFrom: ['X'], sources: [] }], {});
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns empty links when no entities provided', async () => {
    const result = await linkFactsToEntities(
      [{ typeName: 'monetary_amount', value: '$100', sourceSnippet: 'text' }],
      [], {},
    );
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns empty links on LLM failure (graceful degradation)', async () => {
    jest.useFakeTimers();
    const facts: ExtractedFact[] = [
      { typeName: 'monetary_amount', value: '$100', sourceSnippet: 'some text' },
    ];
    const entities: DedupedEntity[] = [
      { typeName: 'person', name: 'Bob', mergedFrom: ['Bob'], sources: [] },
    ];
    mockCreate.mockRejectedValue(new Error('API down'));
    const resultPromise = linkFactsToEntities(facts, entities, {});
    await jest.advanceTimersByTimeAsync(15_000);
    const result = await resultPromise;
    expect(result).toEqual([]);
    jest.useRealTimers();
  });

  it('uses structured output schema', async () => {
    const facts: ExtractedFact[] = [
      { typeName: 'monetary_amount', value: '$100', sourceSnippet: 'text' },
    ];
    const entities: DedupedEntity[] = [
      { typeName: 'person', name: 'Bob', mergedFrom: ['Bob'], sources: [] },
    ];
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ links: [] }) } }],
    });
    await linkFactsToEntities(facts, entities, {});
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: expect.objectContaining({ type: 'json_schema' }),
      }),
    );
  });
});
