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
}

export interface Catalog {
  entityTypes: CatalogType[];
  factTypes: CatalogType[];
}

export interface ExtractionItem {
  id: string;
  name: string;
  documents: Array<{ id: string; filename: string }>;
}

export interface FactItem {
  id: string;
  value: string;
  documents: Array<{ id: string; filename: string }>;
}

export interface Extractions {
  entities: Array<{ type: string; items: ExtractionItem[] }>;
  facts: Array<{ type: string; items: FactItem[] }>;
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

export function updateFactType(id: string, data: { description?: string; prompt?: string }) {
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
