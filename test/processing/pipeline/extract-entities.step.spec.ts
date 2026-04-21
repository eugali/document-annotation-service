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
              entities: [
                {
                  name: 'Bob Smith',
                  sourceSnippet: 'Bob Smith met Jane Doe at the conference.',
                  sourcePage: null,
                  sourceCell: null,
                },
                {
                  name: 'Jane Doe',
                  sourceSnippet: 'Bob Smith met Jane Doe at the conference.',
                  sourcePage: null,
                  sourceCell: null,
                },
              ],
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
      {
        typeName: 'person',
        name: 'Bob Smith',
        sourceSnippet: 'Bob Smith met Jane Doe at the conference.',
        sourcePage: undefined,
        sourceCell: undefined,
        chunkIndex: 0,
      },
      {
        typeName: 'person',
        name: 'Jane Doe',
        sourceSnippet: 'Bob Smith met Jane Doe at the conference.',
        sourcePage: undefined,
        sourceCell: undefined,
        chunkIndex: 0,
      },
    ]);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4',
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
              entities: [
                {
                  name: '',
                  sourceSnippet: 'some text',
                  sourcePage: null,
                  sourceCell: null,
                },
                {
                  name: 'Valid Name',
                  sourceSnippet: 'Valid Name appears here.',
                  sourcePage: null,
                  sourceCell: null,
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await extractEntityType('text', {
      name: 'person',
      prompt: 'Extract names.',
    });

    expect(result).toEqual([
      {
        typeName: 'person',
        name: 'Valid Name',
        sourceSnippet: 'Valid Name appears here.',
        sourcePage: undefined,
        sourceCell: undefined,
        chunkIndex: 0,
      },
    ]);
  });

  it('returns sourceSnippet and sourcePage for each entity', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              entities: [
                {
                  name: 'Bob Smith',
                  sourceSnippet:
                    'Bob Smith signed the contract on page 3.',
                  sourcePage: 3,
                  sourceCell: null,
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await extractEntityType(
      'Bob Smith signed the contract on page 3.',
      { name: 'person', prompt: 'Extract full names of individuals.' },
    );

    expect(result).toEqual([
      {
        typeName: 'person',
        name: 'Bob Smith',
        sourceSnippet: 'Bob Smith signed the contract on page 3.',
        sourcePage: 3,
        sourceCell: undefined,
        chunkIndex: 0,
      },
    ]);
  });
});
