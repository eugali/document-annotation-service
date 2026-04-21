import OpenAI from 'openai';
import { ExtractedFact } from '../pipeline.types';
import { withRetry } from '../../../shared/with-retry';

const factJsonSchema = {
  name: 'fact_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      facts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            value: { type: 'string' },
            sourceSnippet: { type: 'string' },
            sourcePage: { type: ['integer', 'null'] },
            sourceCell: { type: ['string', 'null'] },
          },
          required: ['value', 'sourceSnippet', 'sourcePage', 'sourceCell'],
          additionalProperties: false,
        },
      },
    },
    required: ['facts'],
    additionalProperties: false,
  },
} as const;

export async function extractFactType(
  chunkText: string,
  factType: { name: string; prompt: string },
): Promise<ExtractedFact[]> {
  const client = new OpenAI();

  const prompt = `You are a fact extraction assistant. Extract all facts of the specified type from the text below.

FACT TYPE: "${factType.name}"
INSTRUCTION: ${factType.prompt}

RULES:
- Only extract facts matching the type above
- Each fact MUST have a non-empty "value" field
- Do NOT invent facts not present in the text
- For "sourceSnippet": copy the EXACT sentence(s) from the text where the fact appears. Do NOT paraphrase.
- For "sourcePage": set the page number if identifiable from the text, otherwise null
- For "sourceCell": set the cell reference if this is spreadsheet data, otherwise null

Text:
${chunkText}`;

  const response = await withRetry(
    () =>
      client.chat.completions.create({
        model: 'gpt-5.4',
        response_format: { type: 'json_schema', json_schema: factJsonSchema },
        messages: [{ role: 'user', content: prompt }],
      }),
    { retries: 3, backoffMs: 2000, backoffType: 'exponential' },
  );

  const json = JSON.parse(response.choices[0].message.content as string);
  const rawFacts: {
    value: string;
    sourceSnippet?: string;
    sourcePage?: number | null;
    sourceCell?: string | null;
  }[] = json.facts || [];

  return rawFacts
    .filter((f) => f.value !== undefined && f.value !== '')
    .map((f) => ({
      typeName: factType.name,
      value: f.value,
      sourceSnippet: f.sourceSnippet || '',
      sourcePage: f.sourcePage ?? undefined,
      sourceCell: f.sourceCell ?? undefined,
    }));
}
