import { extractFactType } from '../../../src/processing/pipeline/steps/extract-facts.step';

const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

describe('extractFactType', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('extracts facts for a single type from chunk text', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              facts: [{ value: '50000 EUR' }, { value: '12000 USD' }],
            }),
          },
        },
      ],
    });

    const result = await extractFactType(
      'The contract is worth 50000 EUR and a bonus of 12000 USD.',
      { name: 'monetary_amount', prompt: 'Extract monetary values.' },
    );

    expect(result).toEqual([
      { typeName: 'monetary_amount', value: '50000 EUR' },
      { typeName: 'monetary_amount', value: '12000 USD' },
    ]);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: expect.objectContaining({
          type: 'json_schema',
        }),
      }),
    );
  });

  it('returns empty array when no facts found', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ facts: [] }) } },
      ],
    });

    const result = await extractFactType('No money here.', {
      name: 'monetary_amount',
      prompt: 'Extract monetary values.',
    });

    expect(result).toEqual([]);
  });

  it('filters out facts with empty values', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              facts: [{ value: '' }, { value: '100 EUR' }],
            }),
          },
        },
      ],
    });

    const result = await extractFactType('text', {
      name: 'monetary_amount',
      prompt: 'Extract values.',
    });

    expect(result).toEqual([{ typeName: 'monetary_amount', value: '100 EUR' }]);
  });
});
