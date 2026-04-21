import { chunkDocument } from '../../../src/processing/pipeline/steps/chunk-document.step';

/**
 * Builds a large text string from varied words to ensure realistic tokenization.
 * Single repeated words compress to ~1 token each in cl100k_base, so we cycle
 * through multiple distinct words to get a reliable token-per-word ratio (~1:1).
 */
function buildLargeText(wordCount: number): string {
  const words = [
    'the', 'quick', 'brown', 'fox', 'jumps',
    'over', 'lazy', 'dog', 'and', 'runs',
    'through', 'fields', 'of', 'golden', 'wheat',
  ];
  const parts: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    parts.push(words[i % words.length]);
  }
  return parts.join(' ') + ' ';
}

describe('chunkDocument', () => {
  it('returns single chunk for small document', () => {
    const text = 'Hello world, this is a small document.';
    const chunks = chunkDocument(text, 'doc-1');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].totalChunks).toBe(1);
    expect(chunks[0].documentId).toBe('doc-1');
    expect(chunks[0].text).toBe(text);
  });

  it('splits large text into multiple chunks', () => {
    // ~120k varied words yields ~120k tokens with cl100k_base
    const largeText = buildLargeText(120000);
    const chunks = chunkDocument(largeText, 'doc-2');

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => {
      expect(chunk.chunkIndex).toBe(i);
      expect(chunk.totalChunks).toBe(chunks.length);
      expect(chunk.documentId).toBe('doc-2');
      expect(chunk.text.length).toBeGreaterThan(0);
    });

    // Verify all text is preserved (reassembled)
    const reassembled = chunks.map((c) => c.text).join('');
    expect(reassembled).toBe(largeText);
  });

  it('does not split words at chunk boundaries', () => {
    const largeText = buildLargeText(120000);
    const chunks = chunkDocument(largeText, 'doc-word-boundary');

    expect(chunks.length).toBeGreaterThan(1);

    for (let i = 1; i < chunks.length; i++) {
      const firstChar = chunks[i].text[0];
      // Non-first chunks should start at a word boundary:
      // the first character should be a space, or the previous chunk
      // should end with a space
      const prevLastChar = chunks[i - 1].text[chunks[i - 1].text.length - 1];
      const startsAtWordBoundary =
        firstChar === ' ' || prevLastChar === ' ';
      expect(startsAtWordBoundary).toBe(true);
    }
  });

  it('preserves chunk ordering metadata', () => {
    const largeText = buildLargeText(120000);
    const chunks = chunkDocument(largeText, 'doc-4');

    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[chunks.length - 1].chunkIndex).toBe(chunks.length - 1);
    expect(chunks[0].totalChunks).toBe(chunks.length);
  });
});
