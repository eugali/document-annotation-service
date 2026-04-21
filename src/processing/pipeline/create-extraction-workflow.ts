import { createWorkflow } from '@llamaindex/workflow-core';
import { createStatefulMiddleware } from '@llamaindex/workflow-core/middleware/state';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExtractedEntity,
  ExtractedFact,
  ExtractionTaskResult,
} from './pipeline.types';
import {
  startExtractionEvent,
  documentParsedEvent,
  extractionTaskEvent,
  extractionResultEvent,
  extractionCollectedEvent,
  dedupCompleteEvent,
  linkingCompleteEvent,
  extractionCompleteEvent,
} from './workflow-events';
import { parseDocument } from './steps/parse-document.step';
import { chunkDocument } from './steps/chunk-document.step';
import { extractEntityType } from './steps/extract-entities.step';
import { extractFactType } from './steps/extract-facts.step';
import { deduplicateEntities } from './steps/dedup-entities.step';
import { linkFactsToEntities } from './steps/link-facts-to-entities.step';
import { persistResults } from './steps/persist-results.step';
import { withRetry } from '../../shared/with-retry';

export interface ExtractionWorkflowState {
  documentId: string;
  prisma: PrismaService;
  entityTypes: { name: string; description: string; prompt: string }[];
  factTypes: { name: string; description: string; prompt: string; entityLinkHint?: string }[];
  expectedResultCount: number;
  collectedResults: ExtractionTaskResult[];
}

const { withState } = createStatefulMiddleware(
  (input: ExtractionWorkflowState) => input,
);

export function createExtractionWorkflow() {
  const workflow = withState(createWorkflow());

  // Step 1: Parse document
  workflow.handle([startExtractionEvent], async (_context, event) => {
    const parsed = await withRetry(
      () => parseDocument(event.data.filePath, event.data.mimeType),
      { retries: 2, backoffMs: 0 },
    );
    return documentParsedEvent.with(parsed);
  });

  // Step 2: Chunk and fan-out extraction tasks
  workflow.handle([documentParsedEvent], (context, event) => {
    const { state } = context;
    const chunks = chunkDocument(event.data.fullText, state.documentId);
    const totalTasks =
      chunks.length * (state.entityTypes.length + state.factTypes.length);
    state.expectedResultCount = totalTasks;
    state.collectedResults = [];

    const events = [];
    for (const chunk of chunks) {
      for (const et of state.entityTypes) {
        events.push(
          extractionTaskEvent.with({
            chunk,
            typeName: et.name,
            typePrompt: et.prompt,
            kind: 'entity' as const,
          }),
        );
      }
      for (const ft of state.factTypes) {
        events.push(
          extractionTaskEvent.with({
            chunk,
            typeName: ft.name,
            typePrompt: ft.prompt,
            kind: 'fact' as const,
          }),
        );
      }
    }

    context.sendEvent(...events);
  });

  // Step 3: Per-type extraction (runs for each task event)
  workflow.handle([extractionTaskEvent], async (_context, event) => {
    const { chunk, typeName, typePrompt, kind } = event.data;

    try {
      if (kind === 'entity') {
        const entities = await extractEntityType(chunk.text, {
          name: typeName,
          prompt: typePrompt,
        }, chunk.chunkIndex);
        return extractionResultEvent.with({
          chunkIndex: chunk.chunkIndex,
          typeName,
          kind,
          entities,
        });
      }

      const facts = await extractFactType(chunk.text, {
        name: typeName,
        prompt: typePrompt,
      });
      return extractionResultEvent.with({
        chunkIndex: chunk.chunkIndex,
        typeName,
        kind,
        facts,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return extractionResultEvent.with({
        chunkIndex: chunk.chunkIndex,
        typeName,
        kind,
        error: msg,
      });
    }
  });

  // Step 4: Collect results (fan-in via state accumulation)
  workflow.handle([extractionResultEvent], (context, event) => {
    const { state } = context;
    state.collectedResults.push(event.data);

    if (state.collectedResults.length < state.expectedResultCount) {
      return;
    }

    const entities: ExtractedEntity[] = [];
    const facts: ExtractedFact[] = [];
    const failures: {
      chunkIndex: number;
      typeName: string;
      kind: string;
      error: string;
    }[] = [];

    for (const r of state.collectedResults) {
      if (r.error) {
        failures.push({
          chunkIndex: r.chunkIndex,
          typeName: r.typeName,
          kind: r.kind,
          error: r.error,
        });
      } else if (r.entities) {
        entities.push(...r.entities);
      } else if (r.facts) {
        facts.push(...r.facts);
      }
    }

    return extractionCollectedEvent.with({ entities, facts, failures });
  });

  // Step 5: Deduplicate entities
  workflow.handle([extractionCollectedEvent], async (_context, event) => {
    const { entities, facts, failures } = event.data;
    const dedupedEntities = await deduplicateEntities(entities);

    return dedupCompleteEvent.with({
      entities: dedupedEntities,
      facts,
      links: [],
      failures,
    });
  });

  // Step 6: Link facts to entities
  workflow.handle([dedupCompleteEvent], async (context, event) => {
    const { state } = context;
    const { entities, facts, failures } = event.data;

    const hints: Record<string, string> = {};
    for (const ft of state.factTypes) {
      if (ft.entityLinkHint) {
        hints[ft.name] = ft.entityLinkHint;
      }
    }

    const links = await linkFactsToEntities(facts, entities, hints);

    return linkingCompleteEvent.with({ entities, facts, links, failures });
  });

  // Step 7: Persist results
  workflow.handle([linkingCompleteEvent], async (context, event) => {
    const { state } = context;
    const { entities, facts, links, failures } = event.data;

    await withRetry(
      () => persistResults(state.prisma, state.documentId, entities, facts, links),
      { retries: 2, backoffMs: 500, backoffType: 'fixed' },
    );

    if (failures.length > 0) {
      const errorMsg = failures
        .map(
          (f) =>
            `Extraction failed for chunk ${f.chunkIndex}: ${f.typeName} (${f.kind})`,
        )
        .join('; ');

      await state.prisma.document.update({
        where: { id: state.documentId },
        data: { status: 'partial', error: errorMsg },
      });
    }

    return extractionCompleteEvent.with();
  });

  return workflow;
}
