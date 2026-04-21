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
              facts: [
                {
                  value: '50000 EUR',
                  sourceSnippet: 'The contract is worth 50000 EUR',
                  sourcePage: null,
                  sourceCell: null,
                },
                {
                  value: '12000 USD',
                  sourceSnippet: 'a bonus of 12000 USD',
                  sourcePage: null,
                  sourceCell: null,
                },
              ],
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
      {
        typeName: 'monetary_amount',
        value: '50000 EUR',
        sourceSnippet: 'The contract is worth 50000 EUR',
        sourcePage: undefined,
        sourceCell: undefined,
      },
      {
        typeName: 'monetary_amount',
        value: '12000 USD',
        sourceSnippet: 'a bonus of 12000 USD',
        sourcePage: undefined,
        sourceCell: undefined,
      },
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

  it('returns sourceSnippet and sourcePage for each fact', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              facts: [
                {
                  value: 'EUR 50,000',
                  sourceSnippet:
                    'The contract specifies EUR 50,000 per annum.',
                  sourcePage: 5,
                  sourceCell: null,
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await extractFactType(
      'The contract specifies EUR 50,000 per annum.',
      { name: 'monetary_amount', prompt: 'Extract monetary values.' },
    );

    expect(result).toEqual([
      {
        typeName: 'monetary_amount',
        value: 'EUR 50,000',
        sourceSnippet: 'The contract specifies EUR 50,000 per annum.',
        sourcePage: 5,
        sourceCell: undefined,
      },
    ]);
  });

  it('filters out facts with empty values', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              facts: [
                {
                  value: '',
                  sourceSnippet: '',
                  sourcePage: null,
                  sourceCell: null,
                },
                {
                  value: '100 EUR',
                  sourceSnippet: 'text mentions 100 EUR',
                  sourcePage: null,
                  sourceCell: null,
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await extractFactType('text', {
      name: 'monetary_amount',
      prompt: 'Extract values.',
    });

    expect(result).toEqual([
      {
        typeName: 'monetary_amount',
        value: '100 EUR',
        sourceSnippet: 'text mentions 100 EUR',
        sourcePage: undefined,
        sourceCell: undefined,
      },
    ]);
  });
});
