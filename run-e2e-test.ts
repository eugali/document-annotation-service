import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpectedResult {
  description: string;
  mimeType: string;
  entities: Record<string, string[]>;
  facts: Record<string, string[]>;
}

interface AnnotationResponse {
  status: string;
  error?: string;
  entities?: Record<string, string[]>;
  facts?: Record<string, string[]>;
}

interface MatchResult {
  found: string[];
  missing: string[];
  unexpected: string[];
}

interface FileReport {
  filename: string;
  description: string;
  uploadOk: boolean;
  processingOk: boolean;
  documentId: string | null;
  error: string | null;
  entityResults: Record<string, MatchResult>;
  factResults: Record<string, MatchResult>;
  entityScore: { matched: number; total: number };
  factScore: { matched: number; total: number };
}

interface DocumentListItem {
  id: string;
  filename: string;
  mimeType: string;
  status: string;
  jobId: string | null;
  error: string | null;
  createdAt: string;
}

interface CatalogResponse {
  entityTypes: Array<{ id: string; name: string; description: string; prompt: string }>;
  factTypes: Array<{ id: string; name: string; description: string; prompt: string }>;
}

interface ExtractionsResponse {
  entities: Array<{
    type: string;
    items: Array<{ id: string; name: string; documents: Array<{ id: string; filename: string }> }>;
  }>;
  facts: Array<{
    type: string;
    items: Array<{ id: string; value: string; documents: Array<{ id: string; filename: string }> }>;
  }>;
}

interface JobItem {
  jobId: string;
  documentId: string;
  state: string;
  attemptsMade: number;
  failedReason: string | null;
  finishedOn: number | null;
  processedOn: number | null;
  timestamp: number;
}

type TestFn = () => Promise<void>;

interface TestCase {
  name: string;
  fn: TestFn;
}

// ---------------------------------------------------------------------------
// Test tracking
// ---------------------------------------------------------------------------

const suiteResults: Array<{ suite: string; name: string; passed: boolean; error?: string }> = [];
let currentSuite = '';

function suite(name: string) {
  currentSuite = name;
}

function test(name: string, fn: TestFn): TestCase {
  return { name, fn };
}

async function runTests(tests: TestCase[]) {
  for (const t of tests) {
    try {
      await t.fn();
      suiteResults.push({ suite: currentSuite, name: t.name, passed: true });
      console.log(`    \x1b[32m✓\x1b[0m ${t.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      suiteResults.push({ suite: currentSuite, name: t.name, passed: false, error: msg });
      console.log(`    \x1b[31m✗\x1b[0m ${t.name}`);
      console.log(`      \x1b[31m${msg}\x1b[0m`);
    }
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertGte(actual: number, min: number, label: string) {
  if (actual < min) throw new Error(`${label}: expected >= ${min}, got ${actual}`);
}

// ---------------------------------------------------------------------------
// Fuzzy matching (for LLM extraction comparison)
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]/g, ' ').trim();
}

function extractNumbers(s: string): string[] {
  return s.match(/[\d,.]+/g) || [];
}

function fuzzyMatch(actual: string, expected: string): boolean {
  const normActual = normalize(actual);
  const normExpected = normalize(expected);

  if (normActual === normExpected) return true;
  if (normActual.includes(normExpected)) return true;
  if (normExpected.includes(normActual)) return true;

  const expectedNumbers = extractNumbers(expected);
  if (expectedNumbers.length > 0) {
    const actualNumbers = extractNumbers(actual);
    if (expectedNumbers.every((n) => actualNumbers.some((an) => an === n))) return true;
  }

  const expectedWords = normExpected.split(/\s+/).filter((w) => w.length > 2);
  const matchedWords = expectedWords.filter((w) => normActual.includes(w));
  if (expectedWords.length > 0 && matchedWords.length / expectedWords.length >= 0.6) return true;

  return false;
}

function compareValues(actual: string[], expected: string[]): MatchResult {
  const found: string[] = [];
  const missing: string[] = [];
  const remainingActual = [...actual];

  for (const exp of expected) {
    const matchIdx = remainingActual.findIndex((a) => fuzzyMatch(a, exp));
    if (matchIdx !== -1) {
      found.push(exp);
      remainingActual.splice(matchIdx, 1);
    } else {
      missing.push(exp);
    }
  }

  return { found, missing, unexpected: remainingActual };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
};

async function apiGet<T>(urlPath: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE_URL}${urlPath}`);
  const body = await res.json() as T;
  return { status: res.status, body };
}

async function apiPut<T>(urlPath: string, data: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json() as T;
  return { status: res.status, body };
}

async function uploadFile(filePath: string): Promise<{ id: string }> {
  const fileBuffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  const ext = path.extname(filename).toLowerCase();
  const mimeType = MIME_MAP[ext] || 'application/octet-stream';

  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer], { type: mimeType }), filename);

  const res = await fetch(`${BASE_URL}/documents`, { method: 'POST', body: formData });
  if (res.status !== 202) {
    throw new Error(`Upload failed: HTTP ${res.status} — ${await res.text()}`);
  }
  return res.json() as Promise<{ id: string }>;
}

async function pollUntilDone(documentId: string): Promise<AnnotationResponse> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const { body } = await apiGet<AnnotationResponse>(`/documents/${documentId}/annotations`);
    if (body.status === 'done' || body.status === 'failed') return body;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Timed out after ${POLL_TIMEOUT_MS / 1000}s for document ${documentId}`);
}

// ---------------------------------------------------------------------------
// Phase 1: API endpoint tests (structural — no document processing)
// ---------------------------------------------------------------------------

async function phase1_ApiEndpoints() {
  suite('Phase 1: API Endpoints');

  console.log('\n  \x1b[1mPhase 1: API Endpoint Structure\x1b[0m');

  await runTests([
    test('GET /documents returns array', async () => {
      const { status, body } = await apiGet<DocumentListItem[]>('/documents');
      assertEq(status, 200, 'status');
      assert(Array.isArray(body), 'body should be array');
    }),

    test('GET /documents items have required fields', async () => {
      const { body } = await apiGet<DocumentListItem[]>('/documents');
      if (body.length > 0) {
        const doc = body[0];
        assert('id' in doc, 'missing id');
        assert('filename' in doc, 'missing filename');
        assert('status' in doc, 'missing status');
        assert('jobId' in doc, 'missing jobId');
        assert('createdAt' in doc, 'missing createdAt');
      }
    }),

    test('GET /catalog returns entityTypes and factTypes', async () => {
      const { status, body } = await apiGet<CatalogResponse>('/catalog');
      assertEq(status, 200, 'status');
      assert(Array.isArray(body.entityTypes), 'entityTypes should be array');
      assert(Array.isArray(body.factTypes), 'factTypes should be array');
    }),

    test('GET /catalog has 3 entity types and 4 fact types', async () => {
      const { body } = await apiGet<CatalogResponse>('/catalog');
      assertEq(body.entityTypes.length, 3, 'entity type count');
      assertEq(body.factTypes.length, 4, 'fact type count');
    }),

    test('GET /catalog entity types have id, name, description, prompt', async () => {
      const { body } = await apiGet<CatalogResponse>('/catalog');
      for (const et of body.entityTypes) {
        assert(typeof et.id === 'string' && et.id.length > 0, `entity type missing id`);
        assert(typeof et.name === 'string' && et.name.length > 0, `entity type missing name`);
        assert(typeof et.description === 'string', `entity type ${et.name} missing description`);
        assert(typeof et.prompt === 'string', `entity type ${et.name} missing prompt`);
      }
    }),

    test('GET /catalog expected entity type names', async () => {
      const { body } = await apiGet<CatalogResponse>('/catalog');
      const names = body.entityTypes.map((e) => e.name).sort();
      assertEq(names.join(','), 'location,organization,person', 'entity type names');
    }),

    test('GET /catalog expected fact type names', async () => {
      const { body } = await apiGet<CatalogResponse>('/catalog');
      const names = body.factTypes.map((f) => f.name).sort();
      assertEq(names.join(','), 'contractual_term,date_reference,monetary_amount,percentage', 'fact type names');
    }),

    test('PUT /catalog/entity-types/:id updates description and prompt', async () => {
      const { body: catalog } = await apiGet<CatalogResponse>('/catalog');
      const personType = catalog.entityTypes.find((e) => e.name === 'person')!;
      const originalDesc = personType.description;
      const originalPrompt = personType.prompt;

      const { status, body } = await apiPut<{ description: string; prompt: string }>(
        `/catalog/entity-types/${personType.id}`,
        { description: 'Updated person desc', prompt: 'Updated person prompt' },
      );
      assertEq(status, 200, 'status');
      assertEq(body.description, 'Updated person desc', 'updated description');
      assertEq(body.prompt, 'Updated person prompt', 'updated prompt');

      await apiPut(`/catalog/entity-types/${personType.id}`, {
        description: originalDesc,
        prompt: originalPrompt,
      });
    }),

    test('PUT /catalog/entity-types/nonexistent returns 404', async () => {
      const { status } = await apiPut('/catalog/entity-types/nonexistent', {
        description: 'x',
        prompt: 'y',
      });
      assertEq(status, 404, 'status');
    }),

    test('PUT /catalog/fact-types/:id updates description and prompt', async () => {
      const { body: catalog } = await apiGet<CatalogResponse>('/catalog');
      const moneyType = catalog.factTypes.find((f) => f.name === 'monetary_amount')!;
      const originalDesc = moneyType.description;
      const originalPrompt = moneyType.prompt;

      const { status, body } = await apiPut<{ description: string; prompt: string }>(
        `/catalog/fact-types/${moneyType.id}`,
        { description: 'Updated money desc', prompt: 'Updated money prompt' },
      );
      assertEq(status, 200, 'status');
      assertEq(body.description, 'Updated money desc', 'updated description');

      await apiPut(`/catalog/fact-types/${moneyType.id}`, {
        description: originalDesc,
        prompt: originalPrompt,
      });
    }),

    test('PUT /catalog/fact-types/nonexistent returns 404', async () => {
      const { status } = await apiPut('/catalog/fact-types/nonexistent', {
        description: 'x',
        prompt: 'y',
      });
      assertEq(status, 404, 'status');
    }),

    test('GET /extractions returns entities and facts arrays', async () => {
      const { status, body } = await apiGet<ExtractionsResponse>('/extractions');
      assertEq(status, 200, 'status');
      assert(Array.isArray(body.entities), 'entities should be array');
      assert(Array.isArray(body.facts), 'facts should be array');
    }),

    test('GET /jobs returns array', async () => {
      const { status, body } = await apiGet<JobItem[]>('/jobs');
      assertEq(status, 200, 'status');
      assert(Array.isArray(body), 'body should be array');
    }),

    test('GET /jobs/:jobId returns 404 for nonexistent', async () => {
      const { status } = await apiGet('/jobs/nonexistent-job-999');
      assertEq(status, 404, 'status');
    }),

    test('GET /documents/:id/annotations returns 404 for nonexistent', async () => {
      const { status } = await apiGet('/documents/nonexistent-doc-999/annotations');
      assertEq(status, 404, 'status');
    }),

    test('POST /documents rejects unsupported file type', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['hello'], { type: 'text/plain' }), 'bad.txt');
      const res = await fetch(`${BASE_URL}/documents`, { method: 'POST', body: formData });
      assertEq(res.status, 400, 'status');
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Phase 2: Upload + process all 4 test documents
// ---------------------------------------------------------------------------

const uploadedDocIds: Record<string, string> = {};

async function phase2_UploadAndProcess() {
  suite('Phase 2: Upload & Process Documents');

  console.log('\n  \x1b[1mPhase 2: Upload & Process Documents\x1b[0m');

  const expectedPath = path.join(__dirname, 'test-expected-results.json');
  const expected: Record<string, ExpectedResult> = JSON.parse(
    fs.readFileSync(expectedPath, 'utf-8'),
  );

  for (const [filename, exp] of Object.entries(expected)) {
    await runTests([
      test(`Upload ${filename}`, async () => {
        const filePath = path.join(__dirname, filename);
        assert(fs.existsSync(filePath), `File not found: ${filePath}`);
        const { id } = await uploadFile(filePath);
        assert(typeof id === 'string' && id.length > 0, 'should return document id');
        uploadedDocIds[filename] = id;
      }),
    ]);
  }

  for (const [filename, exp] of Object.entries(expected)) {
    const docId = uploadedDocIds[filename];
    if (!docId) continue;

    await runTests([
      test(`Process ${filename} → done`, async () => {
        const result = await pollUntilDone(docId);
        assert(result.status === 'done', `expected done, got ${result.status}: ${result.error || ''}`);
      }),
    ]);
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Verify jobId stored on documents
// ---------------------------------------------------------------------------

async function phase3_VerifyJobIds() {
  suite('Phase 3: Verify jobId on Documents');

  console.log('\n  \x1b[1mPhase 3: Verify jobId on Documents\x1b[0m');

  await runTests([
    test('GET /documents lists all uploaded documents', async () => {
      const { body } = await apiGet<DocumentListItem[]>('/documents');
      const uploadedIds = Object.values(uploadedDocIds);
      for (const id of uploadedIds) {
        assert(body.some((d) => d.id === id), `document ${id} not found in list`);
      }
    }),

    test('Each uploaded document has a jobId', async () => {
      const { body } = await apiGet<DocumentListItem[]>('/documents');
      const uploadedIds = new Set(Object.values(uploadedDocIds));
      const ourDocs = body.filter((d) => uploadedIds.has(d.id));
      for (const doc of ourDocs) {
        assert(
          doc.jobId !== null && doc.jobId !== undefined,
          `document ${doc.filename} missing jobId`,
        );
      }
    }),

    test('Each uploaded document status is done', async () => {
      const { body } = await apiGet<DocumentListItem[]>('/documents');
      const uploadedIds = new Set(Object.values(uploadedDocIds));
      const ourDocs = body.filter((d) => uploadedIds.has(d.id));
      for (const doc of ourDocs) {
        assertEq(doc.status, 'done', `${doc.filename} status`);
      }
    }),

    test('Documents list ordered by createdAt desc', async () => {
      const { body } = await apiGet<DocumentListItem[]>('/documents');
      for (let i = 1; i < body.length; i++) {
        assert(
          new Date(body[i - 1].createdAt) >= new Date(body[i].createdAt),
          `documents not ordered: ${body[i - 1].createdAt} < ${body[i].createdAt}`,
        );
      }
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Phase 4: Verify extraction accuracy (fuzzy LLM comparison)
// ---------------------------------------------------------------------------

async function phase4_ExtractionAccuracy(): Promise<FileReport[]> {
  suite('Phase 4: Extraction Accuracy');

  console.log('\n  \x1b[1mPhase 4: Extraction Accuracy\x1b[0m');

  const expectedPath = path.join(__dirname, 'test-expected-results.json');
  const expected: Record<string, ExpectedResult> = JSON.parse(
    fs.readFileSync(expectedPath, 'utf-8'),
  );

  const reports: FileReport[] = [];

  for (const [filename, exp] of Object.entries(expected)) {
    const docId = uploadedDocIds[filename];
    if (!docId) continue;

    const report: FileReport = {
      filename,
      description: exp.description,
      uploadOk: true,
      processingOk: false,
      documentId: docId,
      error: null,
      entityResults: {},
      factResults: {},
      entityScore: { matched: 0, total: 0 },
      factScore: { matched: 0, total: 0 },
    };

    try {
      const { body } = await apiGet<AnnotationResponse>(`/documents/${docId}/annotations`);
      if (body.status !== 'done') {
        report.error = `status is ${body.status}`;
        reports.push(report);
        continue;
      }

      report.processingOk = true;
      const actualEntities = body.entities || {};
      const actualFacts = body.facts || {};

      let entityMatched = 0;
      let entityTotal = 0;
      for (const typeName of new Set([...Object.keys(exp.entities), ...Object.keys(actualEntities)])) {
        const match = compareValues(actualEntities[typeName] || [], exp.entities[typeName] || []);
        report.entityResults[typeName] = match;
        entityMatched += match.found.length;
        entityTotal += (exp.entities[typeName] || []).length;
      }
      report.entityScore = { matched: entityMatched, total: entityTotal };

      let factMatched = 0;
      let factTotal = 0;
      for (const typeName of new Set([...Object.keys(exp.facts), ...Object.keys(actualFacts)])) {
        const match = compareValues(actualFacts[typeName] || [], exp.facts[typeName] || []);
        report.factResults[typeName] = match;
        factMatched += match.found.length;
        factTotal += (exp.facts[typeName] || []).length;
      }
      report.factScore = { matched: factMatched, total: factTotal };
    } catch (err) {
      report.error = err instanceof Error ? err.message : String(err);
    }

    reports.push(report);

    const eOk = report.entityScore.matched === report.entityScore.total;
    const fOk = report.factScore.matched === report.factScore.total;
    const icon = eOk && fOk ? '\x1b[32m✓\x1b[0m' : '\x1b[33m~\x1b[0m';
    console.log(`    ${icon} ${filename}: entities ${report.entityScore.matched}/${report.entityScore.total}, facts ${report.factScore.matched}/${report.factScore.total}`);

    for (const [typeName, result] of Object.entries(report.entityResults)) {
      if (result.missing.length > 0) {
        for (const m of result.missing) console.log(`      \x1b[31m- MISSING entity.${typeName}: "${m}"\x1b[0m`);
      }
    }
    for (const [typeName, result] of Object.entries(report.factResults)) {
      if (result.missing.length > 0) {
        for (const m of result.missing) console.log(`      \x1b[31m- MISSING fact.${typeName}: "${m}"\x1b[0m`);
      }
    }
  }

  return reports;
}

// ---------------------------------------------------------------------------
// Phase 5: Verify GET /extractions (cross-document aggregation)
// ---------------------------------------------------------------------------

async function phase5_ExtractionsEndpoint() {
  suite('Phase 5: GET /extractions');

  console.log('\n  \x1b[1mPhase 5: GET /extractions (cross-document aggregation)\x1b[0m');

  await runTests([
    test('GET /extractions returns non-empty entities and facts', async () => {
      const { body } = await apiGet<ExtractionsResponse>('/extractions');
      assertGte(body.entities.length, 1, 'entity groups');
      assertGte(body.facts.length, 1, 'fact groups');
    }),

    test('Entity groups include person, organization, location', async () => {
      const { body } = await apiGet<ExtractionsResponse>('/extractions');
      const types = body.entities.map((g) => g.type);
      assert(types.includes('person'), 'missing person group');
      assert(types.includes('organization'), 'missing organization group');
      assert(types.includes('location'), 'missing location group');
    }),

    test('Fact groups include monetary_amount, date_reference, percentage', async () => {
      const { body } = await apiGet<ExtractionsResponse>('/extractions');
      const types = body.facts.map((g) => g.type);
      assert(types.includes('monetary_amount'), 'missing monetary_amount group');
      assert(types.includes('date_reference'), 'missing date_reference group');
      assert(types.includes('percentage'), 'missing percentage group');
    }),

    test('Each entity item has id, name, and documents array', async () => {
      const { body } = await apiGet<ExtractionsResponse>('/extractions');
      for (const group of body.entities) {
        for (const item of group.items) {
          assert(typeof item.id === 'string', `entity missing id in group ${group.type}`);
          assert(typeof item.name === 'string', `entity missing name in group ${group.type}`);
          assert(Array.isArray(item.documents), `entity missing documents in group ${group.type}`);
        }
      }
    }),

    test('Each fact item has id, value, and documents array', async () => {
      const { body } = await apiGet<ExtractionsResponse>('/extractions');
      for (const group of body.facts) {
        for (const item of group.items) {
          assert(typeof item.id === 'string', `fact missing id in group ${group.type}`);
          assert(typeof item.value === 'string', `fact missing value in group ${group.type}`);
          assert(Array.isArray(item.documents), `fact missing documents in group ${group.type}`);
        }
      }
    }),

    test('Document references have id and filename', async () => {
      const { body } = await apiGet<ExtractionsResponse>('/extractions');
      const allDocRefs = [
        ...body.entities.flatMap((g) => g.items.flatMap((i) => i.documents)),
        ...body.facts.flatMap((g) => g.items.flatMap((i) => i.documents)),
      ];
      for (const ref of allDocRefs) {
        assert(typeof ref.id === 'string' && ref.id.length > 0, 'doc ref missing id');
        assert(typeof ref.filename === 'string' && ref.filename.length > 0, 'doc ref missing filename');
      }
    }),

    test('Person entities span multiple documents', async () => {
      const { body } = await apiGet<ExtractionsResponse>('/extractions');
      const personGroup = body.entities.find((g) => g.type === 'person');
      assert(personGroup !== undefined, 'person group missing');
      const allDocIds = new Set(personGroup!.items.flatMap((i) => i.documents.map((d) => d.id)));
      assertGte(allDocIds.size, 2, 'person entities should link to at least 2 different documents');
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Phase 6: Verify GET /jobs and GET /jobs/:jobId
// ---------------------------------------------------------------------------

async function phase6_JobsEndpoint() {
  suite('Phase 6: GET /jobs');

  console.log('\n  \x1b[1mPhase 6: GET /jobs (BullMQ job status)\x1b[0m');

  await runTests([
    test('GET /jobs returns at least 4 jobs', async () => {
      const { body } = await apiGet<JobItem[]>('/jobs');
      assertGte(body.length, 4, 'job count');
    }),

    test('Each job has required fields', async () => {
      const { body } = await apiGet<JobItem[]>('/jobs');
      for (const job of body) {
        assert(typeof job.jobId === 'string', 'missing jobId');
        assert(typeof job.documentId === 'string', 'missing documentId');
        assert(typeof job.state === 'string', 'missing state');
        assert(typeof job.attemptsMade === 'number', 'missing attemptsMade');
        assert(typeof job.timestamp === 'number', 'missing timestamp');
      }
    }),

    test('All our jobs are in completed state', async () => {
      const { body: docs } = await apiGet<DocumentListItem[]>('/documents');
      const { body: jobs } = await apiGet<JobItem[]>('/jobs');
      const uploadedIds = new Set(Object.values(uploadedDocIds));
      const ourDocs = docs.filter((d) => uploadedIds.has(d.id));
      const ourJobIds = new Set(ourDocs.map((d) => d.jobId).filter(Boolean));

      for (const jobId of ourJobIds) {
        const job = jobs.find((j) => j.jobId === jobId);
        assert(job !== undefined, `job ${jobId} not found in jobs list`);
        assertEq(job!.state, 'completed', `job ${jobId} state`);
      }
    }),

    test('GET /jobs/:jobId returns single job detail', async () => {
      const { body: jobs } = await apiGet<JobItem[]>('/jobs');
      if (jobs.length === 0) throw new Error('no jobs to test');

      const { status, body } = await apiGet<JobItem>(`/jobs/${jobs[0].jobId}`);
      assertEq(status, 200, 'status');
      assertEq(body.jobId, jobs[0].jobId, 'jobId');
      assert(typeof body.state === 'string', 'missing state');
      assert(typeof body.documentId === 'string', 'missing documentId');
    }),

    test('GET /jobs/:jobId returns 404 for nonexistent', async () => {
      const { status } = await apiGet('/jobs/nonexistent-999');
      assertEq(status, 404, 'status');
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Phase 7: Catalog mutation round-trip
// ---------------------------------------------------------------------------

async function phase7_CatalogMutationRoundTrip() {
  suite('Phase 7: Catalog Mutation Round-Trip');

  console.log('\n  \x1b[1mPhase 7: Catalog Mutation Round-Trip\x1b[0m');

  await runTests([
    test('Update entity type prompt, verify via GET, then revert', async () => {
      const { body: before } = await apiGet<CatalogResponse>('/catalog');
      const personType = before.entityTypes.find((e) => e.name === 'person')!;
      const origPrompt = personType.prompt;

      await apiPut(`/catalog/entity-types/${personType.id}`, {
        prompt: 'TEST_ROUND_TRIP_PROMPT',
      });

      const { body: after } = await apiGet<CatalogResponse>('/catalog');
      const updated = after.entityTypes.find((e) => e.name === 'person')!;
      assertEq(updated.prompt, 'TEST_ROUND_TRIP_PROMPT', 'prompt after update');

      await apiPut(`/catalog/entity-types/${personType.id}`, { prompt: origPrompt });

      const { body: reverted } = await apiGet<CatalogResponse>('/catalog');
      const final = reverted.entityTypes.find((e) => e.name === 'person')!;
      assertEq(final.prompt, origPrompt, 'prompt after revert');
    }),

    test('Partial update (only description) preserves prompt', async () => {
      const { body: before } = await apiGet<CatalogResponse>('/catalog');
      const locationType = before.entityTypes.find((e) => e.name === 'location')!;
      const origPrompt = locationType.prompt;
      const origDesc = locationType.description;

      await apiPut(`/catalog/entity-types/${locationType.id}`, {
        description: 'TEST_PARTIAL_UPDATE',
      });

      const { body: after } = await apiGet<CatalogResponse>('/catalog');
      const updated = after.entityTypes.find((e) => e.name === 'location')!;
      assertEq(updated.description, 'TEST_PARTIAL_UPDATE', 'description updated');
      assertEq(updated.prompt, origPrompt, 'prompt preserved');

      await apiPut(`/catalog/entity-types/${locationType.id}`, {
        description: origDesc,
      });
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Final report
// ---------------------------------------------------------------------------

function printFinalReport(fileReports: FileReport[]) {
  console.log('\n' + '='.repeat(70));
  console.log('  FINAL REPORT');
  console.log('='.repeat(70));

  const suites = [...new Set(suiteResults.map((r) => r.suite))];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const s of suites) {
    const results = suiteResults.filter((r) => r.suite === s);
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    totalPassed += passed;
    totalFailed += failed;

    const icon = failed === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`\n  ${icon} ${s}: ${passed}/${results.length} passed`);
    if (failed > 0) {
      for (const r of results.filter((r) => !r.passed)) {
        console.log(`    \x1b[31m✗ ${r.name}: ${r.error}\x1b[0m`);
      }
    }
  }

  if (fileReports.length > 0) {
    let totalEntityMatched = 0;
    let totalEntityExpected = 0;
    let totalFactMatched = 0;
    let totalFactExpected = 0;

    for (const r of fileReports) {
      totalEntityMatched += r.entityScore.matched;
      totalEntityExpected += r.entityScore.total;
      totalFactMatched += r.factScore.matched;
      totalFactExpected += r.factScore.total;
    }

    console.log(`\n  Extraction Accuracy:`);
    console.log(`    Entities: ${totalEntityMatched}/${totalEntityExpected} (${pct(totalEntityMatched, totalEntityExpected)})`);
    console.log(`    Facts:    ${totalFactMatched}/${totalFactExpected} (${pct(totalFactMatched, totalFactExpected)})`);
  }

  console.log('\n' + '-'.repeat(70));
  const color = totalFailed === 0 ? '\x1b[32m' : '\x1b[31m';
  console.log(`  ${color}Tests: ${totalPassed} passed, ${totalFailed} failed, ${totalPassed + totalFailed} total\x1b[0m`);
  console.log('='.repeat(70) + '\n');
}

function pct(matched: number, total: number): string {
  if (total === 0) return '100%';
  return `${Math.round((matched / total) * 100)}%`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(70));
  console.log('  Document Annotation Service — Full E2E Test Suite');
  console.log(`  Server: ${BASE_URL}`);
  console.log(`  Poll interval: ${POLL_INTERVAL_MS / 1000}s, timeout: ${POLL_TIMEOUT_MS / 1000}s`);
  console.log('='.repeat(70));

  await phase1_ApiEndpoints();
  await phase2_UploadAndProcess();
  await phase3_VerifyJobIds();
  const fileReports = await phase4_ExtractionAccuracy();
  await phase5_ExtractionsEndpoint();
  await phase6_JobsEndpoint();
  await phase7_CatalogMutationRoundTrip();

  printFinalReport(fileReports);

  const hasFailed = suiteResults.some((r) => !r.passed);
  process.exit(hasFailed ? 1 : 0);
}

main().catch((err) => {
  console.error('\x1b[31mFatal error:\x1b[0m', err);
  process.exit(1);
});
