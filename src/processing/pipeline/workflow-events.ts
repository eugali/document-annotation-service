import { workflowEvent } from '@llamaindex/workflow-core';
import {
  ParsedDocument,
  DocumentChunk,
  ExtractionTaskResult,
  DedupedEntity,
  ExtractedFact,
} from './pipeline.types';

export interface StartExtractionData {
  documentId: string;
  filePath: string;
  mimeType: string;
}

export interface ExtractionTaskData {
  chunk: DocumentChunk;
  typeName: string;
  typePrompt: string;
  kind: 'entity' | 'fact';
}

export interface ExtractionCollectedData {
  entities: { typeName: string; name: string }[];
  facts: { typeName: string; value: string }[];
  failures: { chunkIndex: number; typeName: string; kind: string; error: string }[];
}

export interface PersistData {
  entities: DedupedEntity[];
  facts: ExtractedFact[];
  failures: { chunkIndex: number; typeName: string; kind: string; error: string }[];
}

export const startExtractionEvent = workflowEvent<StartExtractionData>({
  debugLabel: 'startExtraction',
});

export const documentParsedEvent = workflowEvent<ParsedDocument>({
  debugLabel: 'documentParsed',
});

export const chunkReadyEvent = workflowEvent<DocumentChunk>({
  debugLabel: 'chunkReady',
});

export const extractionTaskEvent = workflowEvent<ExtractionTaskData>({
  debugLabel: 'extractionTask',
});

export const extractionResultEvent = workflowEvent<ExtractionTaskResult>({
  debugLabel: 'extractionResult',
});

export const extractionCollectedEvent = workflowEvent<ExtractionCollectedData>({
  debugLabel: 'extractionCollected',
});

export const dedupCompleteEvent = workflowEvent<PersistData>({
  debugLabel: 'dedupComplete',
});

export const extractionCompleteEvent = workflowEvent<void>({
  debugLabel: 'extractionComplete',
});
