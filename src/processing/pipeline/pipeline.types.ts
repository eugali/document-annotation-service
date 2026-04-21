export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParsedCell {
  sheet: string;
  cell: string;
  value: string | number | null;
}

export interface ParsedDocument {
  type: 'pdf' | 'spreadsheet' | 'word' | 'csv';
  pages?: ParsedPage[];
  cells?: ParsedCell[];
  fullText: string;
}

export interface DocumentChunk {
  chunkIndex: number;
  totalChunks: number;
  documentId: string;
  text: string;
}

export interface ExtractedEntity {
  typeName: string;
  name: string;
  sourceSnippet: string;
  sourcePage?: number;
  sourceCell?: string;
  chunkIndex: number;
}

export interface ExtractedFact {
  typeName: string;
  value: string;
  sourceSnippet: string;
  sourcePage?: number;
  sourceCell?: string;
}

export interface EntitySourceData {
  snippet: string;
  page?: number;
  cell?: string;
  chunkIndex: number;
}

export interface DedupedEntity {
  typeName: string;
  name: string;
  mergedFrom: string[];
  sources: EntitySourceData[];
}

export interface LinkingResult {
  factIndex: number;
  entityNames: string[];
  entityTypes: string[];
}

export interface ExtractionTaskResult {
  chunkIndex: number;
  typeName: string;
  kind: 'entity' | 'fact';
  entities?: ExtractedEntity[];
  facts?: ExtractedFact[];
  error?: string;
}
