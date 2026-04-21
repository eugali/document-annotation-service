import OpenAI from 'openai';
import { ExtractedEntity } from '../pipeline.types';
import { withRetry } from '../../../shared/with-retry';

const entityJsonSchema = {
  name: 'entity_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            sourceSnippet: { type: 'string' },
            sourcePage: { type: ['integer', 'null'] },
            sourceCell: { type: ['string', 'null'] },
          },
          required: ['name', 'sourceSnippet', 'sourcePage', 'sourceCell'],
          additionalProperties: false,
        },
      },
    },
    required: ['entities'],
    additionalProperties: false,
  },
} as const;

export async function extractEntityType(
  chunkText: string,
  entityType: { name: string; prompt: string },
  chunkIndex: number = 0,
): Promise<ExtractedEntity[]> {
  const client = new OpenAI();

  const prompt = `You are an entity extraction assistant. Extract all entities of the specified type from the text below.

ENTITY TYPE: "${entityType.name}"
INSTRUCTION: ${entityType.prompt}

RULES:
- Only extract entities matching the type above
- Each entity MUST have a non-empty "name" field
- Do NOT invent entities not present in the text
- For "sourceSnippet": copy the EXACT sentence(s) from the text where the entity appears. Do NOT paraphrase.
- For "sourcePage": set the page number if identifiable from the text, otherwise null
- For "sourceCell": set the cell reference if this is spreadsheet data, otherwise null

Text:
${chunkText}`;

  const response = await withRetry(
    () =>
      client.chat.completions.create({
        model: 'gpt-5.4',
        response_format: { type: 'json_schema', json_schema: entityJsonSchema },
        messages: [{ role: 'user', content: prompt }],
      }),
    { retries: 3, backoffMs: 2000, backoffType: 'exponential' },
  );

  const json = JSON.parse(response.choices[0].message.content as string);
  const rawEntities: {
    name: string;
    sourceSnippet?: string;
    sourcePage?: number | null;
    sourceCell?: string | null;
  }[] = json.entities || [];

  return rawEntities
    .filter((e) => e.name !== undefined && e.name !== '')
    .map((e) => ({
      typeName: entityType.name,
      name: e.name,
      sourceSnippet: e.sourceSnippet || '',
      sourcePage: e.sourcePage ?? undefined,
      sourceCell: e.sourceCell ?? undefined,
      chunkIndex,
    }));
}
