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
          },
          required: ['value'],
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

Text:
${chunkText}`;

  const response = await withRetry(
    () =>
      client.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_schema', json_schema: factJsonSchema },
        messages: [{ role: 'user', content: prompt }],
      }),
    { retries: 3, backoffMs: 2000, backoffType: 'exponential' },
  );

  const json = JSON.parse(response.choices[0].message.content as string);
  const rawFacts: { value: string }[] = json.facts || [];

  return rawFacts
    .filter((f) => f.value !== undefined && f.value !== '')
    .map((f) => ({ typeName: factType.name, value: f.value }));
}
