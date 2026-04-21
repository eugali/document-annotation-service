import { extractEntityType } from '../../../src/processing/pipeline/steps/extract-entities.step';

const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

describe('extractEntityType', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('extracts entities for a single type from chunk text', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              entities: [{ name: 'Bob Smith' }, { name: 'Jane Doe' }],
            }),
          },
        },
      ],
    });

    const result = await extractEntityType(
      'Bob Smith met Jane Doe at the conference.',
      { name: 'person', prompt: 'Extract full names of individuals.' },
    );

    expect(result).toEqual([
      { typeName: 'person', name: 'Bob Smith' },
      { typeName: 'person', name: 'Jane Doe' },
    ]);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        response_format: expect.objectContaining({
          type: 'json_schema',
        }),
      }),
    );
  });

  it('returns empty array when no entities found', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ entities: [] }),
          },
        },
      ],
    });

    const result = await extractEntityType('No people here.', {
      name: 'person',
      prompt: 'Extract full names.',
    });

    expect(result).toEqual([]);
  });

  it('filters out entities with empty names', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              entities: [{ name: '' }, { name: 'Valid Name' }],
            }),
          },
        },
      ],
    });

    const result = await extractEntityType('text', {
      name: 'person',
      prompt: 'Extract names.',
    });

    expect(result).toEqual([{ typeName: 'person', name: 'Valid Name' }]);
  });
});
