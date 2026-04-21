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
          },
          required: ['name'],
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
): Promise<ExtractedEntity[]> {
  const client = new OpenAI();

  const prompt = `You are an entity extraction assistant. Extract all entities of the specified type from the text below.

ENTITY TYPE: "${entityType.name}"
INSTRUCTION: ${entityType.prompt}

RULES:
- Only extract entities matching the type above
- Each entity MUST have a non-empty "name" field
- Do NOT invent entities not present in the text

Text:
${chunkText}`;

  const response = await withRetry(
    () =>
      client.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_schema', json_schema: entityJsonSchema },
        messages: [{ role: 'user', content: prompt }],
      }),
    { retries: 3, backoffMs: 2000, backoffType: 'exponential' },
  );

  const json = JSON.parse(response.choices[0].message.content as string);
  const rawEntities: { name: string }[] = json.entities || [];

  return rawEntities
    .filter((e) => e.name !== undefined && e.name !== '')
    .map((e) => ({ typeName: entityType.name, name: e.name }));
}
