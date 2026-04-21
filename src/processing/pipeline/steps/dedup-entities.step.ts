import OpenAI from 'openai';
import {
  ExtractedEntity,
  DedupedEntity,
  EntitySourceData,
} from '../pipeline.types';
import { withRetry } from '../../../shared/with-retry';

const dedupJsonSchema = {
  name: 'entity_deduplication',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            typeName: { type: 'string' },
            name: { type: 'string' },
            mergedFrom: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['typeName', 'name', 'mergedFrom'],
          additionalProperties: false,
        },
      },
    },
    required: ['entities'],
    additionalProperties: false,
  },
} as const;

function toEntitySource(e: ExtractedEntity): EntitySourceData {
  return {
    snippet: e.sourceSnippet,
    page: e.sourcePage,
    cell: e.sourceCell,
    chunkIndex: e.chunkIndex,
  };
}

function collectSources(
  mergedFrom: string[],
  typeName: string,
  allEntities: ExtractedEntity[],
): EntitySourceData[] {
  return allEntities
    .filter((e) => e.typeName === typeName && mergedFrom.includes(e.name))
    .map(toEntitySource);
}

function toFallback(entities: ExtractedEntity[]): DedupedEntity[] {
  return entities.map((e) => ({
    typeName: e.typeName,
    name: e.name,
    mergedFrom: [e.name],
    sources: [toEntitySource(e)],
  }));
}

function buildPrompt(grouped: Record<string, string[]>): string {
  return `You are an entity deduplication assistant. Given a list of extracted entities grouped by type, identify duplicates and merge them into canonical entries.

ENTITIES BY TYPE:
${Object.entries(grouped)
  .map(([type, names]) => `Type "${type}": ${JSON.stringify(names)}`)
  .join('\n')}

RULES:
- Merge entities that clearly refer to the same real-world entity (e.g., "John Doe" and "J. Doe")
- NEVER merge entities of different types
- For each canonical entity, list ALL original names in "mergedFrom" (including the canonical name)
- If an entity has no duplicates, its "mergedFrom" contains only its own name
- Preserve the original typeName for each entity`;
}

export async function deduplicateEntities(
  entities: ExtractedEntity[],
): Promise<DedupedEntity[]> {
  if (entities.length === 0) return [];

  const client = new OpenAI();
  const grouped = entities.reduce(
    (acc, e) => {
      const existing = acc[e.typeName] ?? [];
      return { ...acc, [e.typeName]: [...existing, e.name] };
    },
    {} as Record<string, string[]>,
  );

  try {
    const response = await withRetry(
      () =>
        client.chat.completions.create({
          model: 'gpt-5.4',
          response_format: {
            type: 'json_schema',
            json_schema: dedupJsonSchema,
          },
          messages: [{ role: 'user', content: buildPrompt(grouped) }],
        }),
      { retries: 3, backoffMs: 2000, backoffType: 'exponential' },
    );

    const json = JSON.parse(response.choices[0].message.content as string);
    const rawDeduped = json.entities as Array<{
      typeName: string;
      name: string;
      mergedFrom: string[];
    }>;

    return rawDeduped.map((d) => ({
      ...d,
      sources: collectSources(d.mergedFrom, d.typeName, entities),
    }));
  } catch {
    return toFallback(entities);
  }
}
