import { encode } from 'gpt-tokenizer';
import { DocumentChunk } from '../pipeline.types';
import { CHUNK_TARGET_TOKENS } from '../../../config/constants';

export function chunkDocument(
  fullText: string,
  documentId: string,
): DocumentChunk[] {
  const tokens = encode(fullText);

  if (tokens.length <= CHUNK_TARGET_TOKENS) {
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        documentId,
        text: fullText,
      },
    ];
  }

  const chunks: DocumentChunk[] = [];
  let charOffset = 0;
  const avgCharsPerToken = fullText.length / tokens.length;

  for (
    let tokenStart = 0;
    tokenStart < tokens.length;
    tokenStart += CHUNK_TARGET_TOKENS
  ) {
    const remainingTokens = tokens.length - tokenStart;
    const chunkTokenCount = Math.min(CHUNK_TARGET_TOKENS, remainingTokens);

    let endCharPos = charOffset + Math.ceil(chunkTokenCount * avgCharsPerToken);

    if (endCharPos >= fullText.length) {
      endCharPos = fullText.length;
    } else {
      const spaceIdx = fullText.lastIndexOf(' ', endCharPos);
      if (spaceIdx > charOffset) {
        endCharPos = spaceIdx + 1;
      }
    }

    chunks.push({
      chunkIndex: chunks.length,
      totalChunks: 0,
      documentId,
      text: fullText.slice(charOffset, endCharPos),
    });

    charOffset = endCharPos;
  }

  if (charOffset < fullText.length) {
    const lastChunk = chunks[chunks.length - 1];
    chunks[chunks.length - 1] = {
      ...lastChunk,
      text: lastChunk.text + fullText.slice(charOffset),
    };
  }

  return chunks.map((c) => ({ ...c, totalChunks: chunks.length }));
}
