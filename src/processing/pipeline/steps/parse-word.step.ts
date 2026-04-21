import * as mammoth from 'mammoth';
import { ParsedDocument } from '../pipeline.types';

export async function parseWord(filePath: string): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ path: filePath });

  return {
    type: 'word',
    fullText: result.value,
  };
}
