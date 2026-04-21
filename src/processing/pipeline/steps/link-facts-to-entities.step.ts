import OpenAI from 'openai';
import {
  ExtractedFact,
  DedupedEntity,
  LinkingResult,
} from '../pipeline.types';
import { withRetry } from '../../../shared/with-retry';

const linkingJsonSchema = {
  name: 'fact_entity_linking',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      links: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            factIndex: { type: 'integer' },
            entityNames: {
              type: 'array',
              items: { type: 'string' },
            },
            entityTypes: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['factIndex', 'entityNames', 'entityTypes'],
          additionalProperties: false,
        },
      },
    },
    required: ['links'],
    additionalProperties: false,
  },
} as const;

function buildFactLine(
  fact: ExtractedFact,
  index: number,
  hints: Record<string, string>,
): string {
  const hint = hints[fact.typeName];
  const hintSuffix = hint ? ` (hint: ${hint})` : '';
  return `[${index}] type="${fact.typeName}" value="${fact.value}" snippet="${fact.sourceSnippet}"${hintSuffix}`;
}

function buildEntityLine(entity: DedupedEntity): string {
  return `- "${entity.name}" (type: ${entity.typeName})`;
}

function buildPrompt(
  facts: ExtractedFact[],
  entities: DedupedEntity[],
  hints: Record<string, string>,
): string {
  const factLines = facts
    .map((f, i) => buildFactLine(f, i, hints))
    .join('\n');
  const entityLines = entities.map(buildEntityLine).join('\n');

  return `You are a fact-entity linking assistant. For each fact, determine which entities it relates to based on the source snippet context.

FACTS:
${factLines}

ENTITIES:
${entityLines}

RULES:
- Link each fact to zero or more entities based on the source snippet context
- A fact can be linked to multiple entities if the snippet references them
- entityNames and entityTypes arrays must have the same length (paired by index)
- Only use entity names and types from the provided list
- If a fact cannot be confidently linked to any entity, return empty arrays for that fact
- Use the hint (if provided) to guide linking decisions`;
}

export async function linkFactsToEntities(
  facts: ExtractedFact[],
  entities: DedupedEntity[],
  hints: Record<string, string>,
): Promise<LinkingResult[]> {
  if (facts.length === 0 || entities.length === 0) return [];

  const client = new OpenAI();

  try {
    const response = await withRetry(
      () =>
        client.chat.completions.create({
          model: 'gpt-4o-mini',
          response_format: {
            type: 'json_schema',
            json_schema: linkingJsonSchema,
          },
          messages: [
            { role: 'user', content: buildPrompt(facts, entities, hints) },
          ],
        }),
      { retries: 3, backoffMs: 2000, backoffType: 'exponential' },
    );

    const json = JSON.parse(response.choices[0].message.content as string);
    const rawLinks = json.links as LinkingResult[];

    return rawLinks;
  } catch {
    return [];
  }
}
