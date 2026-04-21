import { parseWord } from '../../../src/processing/pipeline/steps/parse-word.step';
import * as mammoth from 'mammoth';

jest.mock('mammoth');

describe('parseWord', () => {
  const mockExtractRawText = mammoth.extractRawText as jest.MockedFunction<
    typeof mammoth.extractRawText
  >;

  beforeEach(() => {
    mockExtractRawText.mockReset();
  });

  it('extracts plain text from a .docx file', async () => {
    mockExtractRawText.mockResolvedValue({
      value: 'Hello World\nThis is a test document.',
      messages: [],
    });

    const result = await parseWord('/tmp/test.docx');

    expect(result.type).toBe('word');
    expect(result.fullText).toBe('Hello World\nThis is a test document.');
    expect(mockExtractRawText).toHaveBeenCalledWith({ path: '/tmp/test.docx' });
  });

  it('returns empty text for empty document', async () => {
    mockExtractRawText.mockResolvedValue({
      value: '',
      messages: [],
    });

    const result = await parseWord('/tmp/empty.docx');

    expect(result.type).toBe('word');
    expect(result.fullText).toBe('');
  });

  it('throws on mammoth failure', async () => {
    mockExtractRawText.mockRejectedValue(new Error('Corrupt file'));

    await expect(parseWord('/tmp/bad.docx')).rejects.toThrow('Corrupt file');
  });
});
