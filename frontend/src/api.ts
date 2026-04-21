const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface Document {
  id: string;
  filename: string;
  mimeType: string;
  status: string;
  jobId: string | null;
  error: string | null;
  createdAt: string;
}

export interface Annotations {
  status: string;
  entities?: Record<string, string[]>;
  facts?: Record<string, string[]>;
  error?: string;
}

export interface CatalogType {
  id: string;
  name: string;
  description: string;
  prompt: string;
  entityLinkHint?: string | null;
}

export interface Catalog {
  entityTypes: CatalogType[];
  factTypes: CatalogType[];
}

export interface EntitySource {
  snippet: string;
  page: number | null;
  cell: string | null;
  chunkIndex: number;
}

export interface ExtractionItem {
  id: string;
  name: string;
  documents: Array<{ id: string; filename: string }>;
  sources: EntitySource[];
  linkedFactIds: string[];
}

export interface LinkedEntity {
  id: string;
  name: string;
}

export interface FactItem {
  id: string;
  value: string;
  sourceSnippet: string;
  sourcePage: number | null;
  sourceCell: string | null;
  documents: Array<{ id: string; filename: string }>;
  linkedEntities: LinkedEntity[];
}

export interface GraphDocument {
  id: string;
  filename: string;
  status: string;
}

export interface Extractions {
  entities: Array<{ type: string; items: ExtractionItem[] }>;
  facts: Array<{ type: string; items: FactItem[] }>;
  documents: GraphDocument[];
}

export interface Job {
  jobId: string;
  documentId: string;
  state: string;
  attemptsMade: number;
  failedReason: string | null;
  finishedOn: number | null;
  processedOn: number | null;
  timestamp: number;
}

export function getDocuments() {
  return request<Document[]>('/documents');
}

export function getAnnotations(id: string) {
  return request<Annotations>(`/documents/${id}/annotations`);
}

export async function uploadDocument(file: File) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/documents`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ id: string }>;
}

export function getCatalog() {
  return request<Catalog>('/catalog');
}

export function updateEntityType(id: string, data: { description?: string; prompt?: string }) {
  return request(`/catalog/entity-types/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function updateFactType(id: string, data: { description?: string; prompt?: string; entityLinkHint?: string }) {
  return request(`/catalog/fact-types/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function getExtractions() {
  return request<Extractions>('/extractions');
}

export function getJobs() {
  return request<Job[]>('/jobs');
}

export function getJob(jobId: string) {
  return request<Job>(`/jobs/${jobId}`);
}

export function createEntityType(data: { name: string; description: string; prompt: string }) {
  return request('/catalog/entity-types', { method: 'POST', body: JSON.stringify(data) });
}

export function deleteEntityType(id: string) {
  return request(`/catalog/entity-types/${id}`, { method: 'DELETE' });
}

export function createFactType(data: { name: string; description: string; prompt: string; entityLinkHint?: string }) {
  return request('/catalog/fact-types', { method: 'POST', body: JSON.stringify(data) });
}

export function deleteFactType(id: string) {
  return request(`/catalog/fact-types/${id}`, { method: 'DELETE' });
}
