# Fact-Entity Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add source provenance, fact-entity linking, cross-document entity sharing, catalog CRUD, a graph view, and a README tab to the document-annotation-service.

**Architecture:** Extends the existing LlamaIndex extraction pipeline with source snippet tracking through extraction/dedup/linking/persist. Adds a post-dedup LLM step for fact-entity linking. Enriches the Prisma schema with `EntitySource`, `FactEntity`, and new columns. Replaces flat extraction tables with a graph canvas. Adds catalog create/delete endpoints and UI.

**Tech Stack:** NestJS 11, Prisma 7 (SQLite), OpenAI gpt-4o-mini, LlamaIndex workflow-core 1.3.3, React + Vite, Jest 30, react-force-graph-2d (new)

---

## ✅ Implementation Status (aligned 2026-04-21)

**Tasks 1-12: COMPLETE. Task 13: DROPPED. Task 14: MODIFIED.**

### Deviations from Plan

| Area | Plan | Actual |
|------|------|--------|
| **LLM Model** | `gpt-4o-mini` | `gpt-5.4` |
| **Task 13 (Graph View)** | New `GraphTab.tsx` with `react-force-graph-2d` | **DROPPED** — no graph component, no graph tab. `ExtractionsTab.tsx` orphaned on disk (not in App.tsx routes) |
| **Task 14 (README Tab)** | iframe-only embed of workflow diagram | Modified — includes native **Improvements sections** (GenAI Pipeline + General Platform) below the iframe |
| **App.tsx routing** | `useState`-based tab switching | `react-router-dom` with `<BrowserRouter>` |
| **Active tabs** | readme, documents, catalog, graph, jobs, improvements | **readme, documents, catalog, jobs** |
| **dedupCompleteEvent** | Separate event type from PersistData | Uses `PersistData` type (emitted with `links: []` initially) |
| **Tech stack** | `react-force-graph-2d` dependency | Installed but **unused** (graph tab dropped) |

### Summary by Task
- **Tasks 1-9**: Fully implemented as planned (schema, types, entity/fact extraction with sources, dedup source preservation, linking step, workflow wiring, persist with upsert/sources/links, catalog CRUD)
- **Task 10 (Extractions API)**: Done — enriched with sources, linkedFactIds, linkedEntities
- **Task 11 (Frontend API)**: Done — CRUD functions and enriched types
- **Task 12 (Catalog CRUD UI)**: Done — create forms, delete buttons, entityLinkHint
- **Task 13 (Graph View)**: ❌ **DROPPED**
- **Task 14 (README Tab)**: Done with modifications
- **Task 15 (Test Suite)**: Done

---

---

## Technical Context

### Key File Paths
- Schema: `prisma/schema.prisma` (92 lines)
- Pipeline types: `src/processing/pipeline/pipeline.types.ts` (50 lines)
- Workflow events: `src/processing/pipeline/workflow-events.ts` (66 lines)
- Workflow factory: `src/processing/pipeline/create-extraction-workflow.ts` (203 lines)
- Workflow runner: `src/processing/pipeline/extraction.workflow.ts` (68 lines)
- Entity extraction: `src/processing/pipeline/steps/extract-entities.step.ts` (64 lines)
- Fact extraction: `src/processing/pipeline/steps/extract-facts.step.ts` (64 lines)
- Entity dedup: `src/processing/pipeline/steps/dedup-entities.step.ts` (91 lines)
- Persist: `src/processing/pipeline/steps/persist-results.step.ts` (54 lines)
- Catalog service: `src/catalog/catalog.service.ts` (36 lines)
- Catalog controller: `src/catalog/catalog.controller.ts` (30 lines)
- Catalog DTO: `src/catalog/catalog.dto.ts` (12 lines)
- Extractions service: `src/extractions/extractions.service.ts` (65 lines)
- Frontend API: `frontend/src/api.ts` (120 lines)
- Frontend App: `frontend/src/App.tsx` (30 lines)
- Frontend ExtractionsTab: `frontend/src/tabs/ExtractionsTab.tsx` (101 lines)
- Frontend CatalogTab: `frontend/src/tabs/CatalogTab.tsx` (99 lines)
- Workflow diagram: `workflow-diagram.html` (standalone HTML)

### Current Interfaces
- `ExtractedEntity`: `{ typeName: string; name: string }`
- `ExtractedFact`: `{ typeName: string; value: string }`
- `DedupedEntity`: `{ typeName: string; name: string; mergedFrom: string[] }`
- `ExtractionTaskResult`: `{ chunkIndex: number; typeName: string; kind: 'entity' | 'fact'; entities?: ExtractedEntity[]; facts?: ExtractedFact[]; error?: string }`
- `PersistData`: `{ entities: DedupedEntity[]; facts: ExtractedFact[]; failures: {...}[] }`
- `persistResults(prisma, documentId, entities, facts): Promise<void>` — takes `ExtractedEntity[]` (which is structurally compatible with `DedupedEntity[]`)
- `deduplicateEntities(entities: ExtractedEntity[]): Promise<DedupedEntity[]>`
- `extractEntityType(chunkText, entityType: { name, prompt }): Promise<ExtractedEntity[]>`
- `extractFactType(chunkText, factType: { name, prompt }): Promise<ExtractedFact[]>`
- `ExtractionWorkflowState`: `{ documentId, prisma, entityTypes: { name, description, prompt }[], factTypes: { name, description, prompt }[], expectedResultCount, collectedResults }`

### Test Patterns
- Tests live in `test/` mirroring `src/` structure
- Pipeline step tests mock OpenAI: `jest.mock('openai')` with `mockCreate = jest.fn()`
- Integration tests (persist, controllers) use real PrismaService with beforeEach cleanup
- Controller tests use `@nestjs/testing` with `supertest`
- Run: `npx jest test/path/file.spec.ts --no-cache`

### Schema Notes
- `Entity.entityType` and `Fact.factType` relations currently have NO `onDelete: Cascade` — must be added
- `DocumentEntity` and `DocumentFact` already have `onDelete: Cascade` on both FKs
- No unique constraint on `Entity(entityTypeId, name)` — entities are always created fresh per document

---

## File Structure

### New Files
- `src/processing/pipeline/pipeline.types.ts` — modified (add source fields to types, add `LinkingResult`)
- `src/processing/pipeline/workflow-events.ts` — modified (add `linkingCompleteEvent`, update `PersistData`)
- `src/processing/pipeline/steps/link-facts-to-entities.step.ts` — **new** (LLM linking step)
- `src/catalog/catalog.dto.ts` — modified (add create DTOs)
- `frontend/src/tabs/GraphTab.tsx` — **new** (graph visualization)
- `frontend/src/tabs/ReadmeTab.tsx` — **new** (iframe embed)
- `test/processing/pipeline/link-facts-to-entities.step.spec.ts` — **new**

### Modified Files
- `prisma/schema.prisma` — add EntitySource, FactEntity, columns, cascades, unique constraint
- `src/processing/pipeline/steps/extract-entities.step.ts` — add sourceSnippet to schema/prompt
- `src/processing/pipeline/steps/extract-facts.step.ts` — add sourceSnippet to schema/prompt
- `src/processing/pipeline/steps/dedup-entities.step.ts` — preserve sources through dedup
- `src/processing/pipeline/steps/persist-results.step.ts` — upsert entities, save sources, save links
- `src/processing/pipeline/create-extraction-workflow.ts` — wire linking step, update event handling
- `src/processing/pipeline/extraction.workflow.ts` — pass factTypes with entityLinkHint to state
- `src/catalog/catalog.service.ts` — add create/delete methods
- `src/catalog/catalog.controller.ts` — add POST/DELETE endpoints
- `src/extractions/extractions.service.ts` — include sources and links in response
- `frontend/src/api.ts` — add CRUD functions, update types
- `frontend/src/App.tsx` — add README tab, rename extractions to Graph
- `frontend/src/tabs/CatalogTab.tsx` — add create/delete UI

---

### Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Test: manual `prisma migrate dev` verification

- [x] **Step 1: Update Fact model with source columns**

In `prisma/schema.prisma`, update the `Fact` model:

```prisma
model Fact {
  id             String         @id @default(uuid())
  factTypeId     String
  factType       FactType       @relation(fields: [factTypeId], references: [id], onDelete: Cascade)
  value          String
  sourceSnippet  String         @default("")
  sourcePage     Int?
  sourceCell     String?
  createdAt      DateTime       @default(now())
  documents      DocumentFact[]
  entities       FactEntity[]

  @@index([factTypeId])
}
```

- [x] **Step 2: Update FactType model with entityLinkHint**

```prisma
model FactType {
  id              String   @id @default(uuid())
  name            String   @unique
  description     String
  prompt          String
  entityLinkHint  String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  facts           Fact[]
}
```

- [x] **Step 3: Add EntitySource model**

```prisma
model EntitySource {
  id         String  @id @default(uuid())
  entityId   String
  entity     Entity  @relation(fields: [entityId], references: [id], onDelete: Cascade)
  snippet    String
  page       Int?
  cell       String?
  chunkIndex Int

  @@index([entityId])
}
```

- [x] **Step 4: Add FactEntity junction model**

```prisma
model FactEntity {
  id       String @id @default(uuid())
  factId   String
  fact     Fact   @relation(fields: [factId], references: [id], onDelete: Cascade)
  entityId String
  entity   Entity @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@unique([factId, entityId])
  @@index([factId])
  @@index([entityId])
}
```

- [x] **Step 5: Update Entity model with cascade, unique constraint, and relations**

```prisma
model Entity {
  id           String           @id @default(uuid())
  entityTypeId String
  entityType   EntityType       @relation(fields: [entityTypeId], references: [id], onDelete: Cascade)
  name         String
  createdAt    DateTime         @default(now())
  documents    DocumentEntity[]
  sources      EntitySource[]
  facts        FactEntity[]

  @@unique([entityTypeId, name])
  @@index([entityTypeId])
}
```

Note: Adding `@@unique([entityTypeId, name])` may fail if duplicate data exists from prior runs. Before migrating, check:
```bash
sqlite3 prisma/dev.db "SELECT entityTypeId, name, COUNT(*) c FROM Entity GROUP BY entityTypeId, name HAVING c > 1;"
```
If duplicates exist, deduplicate them manually first or add a migration step.

- [x] **Step 6: Update EntityType to add cascade**

Change the `Entity` relation in `EntityType` — no model change needed since cascade is on the child side (already done in Step 5 above). Verify `EntityType` model has `entities Entity[]` relation (it already does).

- [x] **Step 7: Run the migration**

```bash
cd /Users/eugeniogalioto/Freelancing/a.team/document-annotation-service
npx prisma migrate dev --name add-provenance-linking-cascade
```

Expected: Migration created and applied successfully.

- [x] **Step 8: Verify the schema**

```bash
npx prisma studio
```

Verify: EntitySource, FactEntity tables exist. Fact has sourceSnippet, sourcePage, sourceCell. FactType has entityLinkHint. Entity has unique constraint on (entityTypeId, name).

- [x] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add source provenance, fact-entity linking, and cascade schema changes"
```

---

### Task 2: Pipeline Types Update

**Files:**
- Modify: `src/processing/pipeline/pipeline.types.ts`
- Test: `test/processing/pipeline/extract-entities.step.spec.ts` (updated assertions)

- [x] **Step 1: Update ExtractedEntity type**

In `src/processing/pipeline/pipeline.types.ts`, replace the `ExtractedEntity` interface:

```typescript
export interface ExtractedEntity {
  typeName: string;
  name: string;
  sourceSnippet: string;
  sourcePage?: number;
  sourceCell?: string;
  chunkIndex: number;
}
```

- [x] **Step 2: Update ExtractedFact type**

```typescript
export interface ExtractedFact {
  typeName: string;
  value: string;
  sourceSnippet: string;
  sourcePage?: number;
  sourceCell?: string;
}
```

- [x] **Step 3: Update DedupedEntity type**

```typescript
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
```

- [x] **Step 4: Add LinkingResult type**

```typescript
export interface LinkingResult {
  factIndex: number;
  entityNames: string[];
  entityTypes: string[];
}
```

- [x] **Step 5: Run existing tests to confirm type changes are detected**

```bash
npx jest --no-cache 2>&1 | head -50
```

Expected: Multiple test failures due to updated type shapes (missing required fields in test data). This confirms the types propagated. We'll fix these tests as we update each step.

- [x] **Step 6: Commit**

```bash
git add src/processing/pipeline/pipeline.types.ts
git commit -m "feat: add source provenance and linking types to pipeline"
```

---

### Task 3: Entity Extraction with Source Snippets

**Files:**
- Modify: `src/processing/pipeline/steps/extract-entities.step.ts`
- Test: `test/processing/pipeline/extract-entities.step.spec.ts`

- [x] **Step 1: Write the failing test for source snippet extraction**

In `test/processing/pipeline/extract-entities.step.spec.ts`, add a new test:

```typescript
it('returns sourceSnippet and sourcePage for each entity', async () => {
  mockCreate.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            entities: [
              { name: 'Bob Smith', sourceSnippet: 'Bob Smith signed the contract on page 3.', sourcePage: 3 },
            ],
          }),
        },
      },
    ],
  });

  const result = await extractEntityType(
    'Bob Smith signed the contract on page 3.',
    { name: 'person', prompt: 'Extract full names of individuals.' },
  );

  expect(result).toEqual([
    {
      typeName: 'person',
      name: 'Bob Smith',
      sourceSnippet: 'Bob Smith signed the contract on page 3.',
      sourcePage: 3,
      sourceCell: undefined,
      chunkIndex: 0,
    },
  ]);
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx jest test/processing/pipeline/extract-entities.step.spec.ts --no-cache
```

Expected: FAIL — current implementation doesn't return source fields.

- [x] **Step 3: Update the JSON schema and prompt**

In `src/processing/pipeline/steps/extract-entities.step.ts`, update `entityJsonSchema`:

```typescript
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
```

Update the function signature to accept `chunkIndex`:

```typescript
export async function extractEntityType(
  chunkText: string,
  entityType: { name: string; prompt: string },
  chunkIndex: number = 0,
): Promise<ExtractedEntity[]> {
```

Update the prompt to request source snippets:

```typescript
const prompt = `You are an entity extraction assistant. Extract all entities of the specified type from the text below.

ENTITY TYPE: "${entityType.name}"
INSTRUCTION: ${entityType.prompt}

RULES:
- Only extract entities matching the type above
- Each entity MUST have a non-empty "name" field
- For "sourceSnippet": copy the EXACT sentence(s) from the text where the entity appears. Do NOT paraphrase.
- For "sourcePage": set the page number if identifiable from the text, otherwise null
- For "sourceCell": set the cell reference if this is spreadsheet data, otherwise null
- Do NOT invent entities not present in the text

Text:
${chunkText}`;
```

Update the return mapping:

```typescript
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
```

- [x] **Step 4: Update existing tests to match new type shape**

Update the existing test mocks to include source fields and add `chunkIndex` parameter where needed. The `'extracts entities for a single type'` test mock response needs `sourceSnippet`, `sourcePage`, `sourceCell` in the response, and the assertion needs to match the full `ExtractedEntity` shape:

```typescript
it('extracts entities for a single type from chunk text', async () => {
  mockCreate.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            entities: [
              { name: 'Bob Smith', sourceSnippet: 'Bob Smith met Jane Doe', sourcePage: null, sourceCell: null },
              { name: 'Jane Doe', sourceSnippet: 'Bob Smith met Jane Doe', sourcePage: null, sourceCell: null },
            ],
          }),
        },
      },
    ],
  });

  const result = await extractEntityType(
    'Bob Smith met Jane Doe at the conference.',
    { name: 'person', prompt: 'Extract full names of individuals.' },
    0,
  );

  expect(result).toEqual([
    { typeName: 'person', name: 'Bob Smith', sourceSnippet: 'Bob Smith met Jane Doe', sourcePage: undefined, sourceCell: undefined, chunkIndex: 0 },
    { typeName: 'person', name: 'Jane Doe', sourceSnippet: 'Bob Smith met Jane Doe', sourcePage: undefined, sourceCell: undefined, chunkIndex: 0 },
  ]);
});
```

Update the `'returns empty array'` and `'filters out empty names'` tests similarly.

- [x] **Step 5: Run tests**

```bash
npx jest test/processing/pipeline/extract-entities.step.spec.ts --no-cache
```

Expected: All PASS.

- [x] **Step 6: Commit**

```bash
git add src/processing/pipeline/steps/extract-entities.step.ts test/processing/pipeline/extract-entities.step.spec.ts
git commit -m "feat: add source provenance to entity extraction step"
```

---

### Task 4: Fact Extraction with Source Snippets

**Files:**
- Modify: `src/processing/pipeline/steps/extract-facts.step.ts`
- Test: `test/processing/pipeline/extract-facts.step.spec.ts`

- [x] **Step 1: Write the failing test**

```typescript
it('returns sourceSnippet and sourcePage for each fact', async () => {
  mockCreate.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            facts: [
              { value: 'EUR 50,000', sourceSnippet: 'The contract specifies EUR 50,000 per annum.', sourcePage: 5, sourceCell: null },
            ],
          }),
        },
      },
    ],
  });

  const result = await extractFactType(
    'The contract specifies EUR 50,000 per annum.',
    { name: 'monetary_amount', prompt: 'Extract monetary values.' },
  );

  expect(result).toEqual([
    {
      typeName: 'monetary_amount',
      value: 'EUR 50,000',
      sourceSnippet: 'The contract specifies EUR 50,000 per annum.',
      sourcePage: 5,
      sourceCell: undefined,
    },
  ]);
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx jest test/processing/pipeline/extract-facts.step.spec.ts --no-cache
```

Expected: FAIL.

- [x] **Step 3: Update JSON schema, prompt, and return mapping**

Same pattern as Task 3. Update `factJsonSchema` to include `sourceSnippet`, `sourcePage`, `sourceCell`. Update the prompt to request verbatim source snippets. Update the return mapping:

```typescript
return rawFacts
  .filter((f) => f.value !== undefined && f.value !== '')
  .map((f) => ({
    typeName: factType.name,
    value: f.value,
    sourceSnippet: f.sourceSnippet || '',
    sourcePage: f.sourcePage ?? undefined,
    sourceCell: f.sourceCell ?? undefined,
  }));
```

- [x] **Step 4: Update existing tests, run all**

```bash
npx jest test/processing/pipeline/extract-facts.step.spec.ts --no-cache
```

Expected: All PASS.

- [x] **Step 5: Commit**

```bash
git add src/processing/pipeline/steps/extract-facts.step.ts test/processing/pipeline/extract-facts.step.spec.ts
git commit -m "feat: add source provenance to fact extraction step"
```

---

### Task 5: Dedup Source Preservation

**Files:**
- Modify: `src/processing/pipeline/steps/dedup-entities.step.ts`
- Test: `test/processing/pipeline/dedup-entities.step.spec.ts`

- [x] **Step 1: Write the failing test for source collection through dedup**

```typescript
it('collects sources from all merged entities via mergedFrom', async () => {
  const entities: ExtractedEntity[] = [
    { typeName: 'person', name: 'John Doe', sourceSnippet: 'John Doe on page 2', sourcePage: 2, sourceCell: undefined, chunkIndex: 0 },
    { typeName: 'person', name: 'J. Doe', sourceSnippet: 'J. Doe signed on page 17', sourcePage: 17, sourceCell: undefined, chunkIndex: 3 },
    { typeName: 'organization', name: 'Acme Corp', sourceSnippet: 'Acme Corp HQ', sourcePage: 1, sourceCell: undefined, chunkIndex: 0 },
  ];

  mockCreate.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            entities: [
              { typeName: 'person', name: 'John Doe', mergedFrom: ['John Doe', 'J. Doe'] },
              { typeName: 'organization', name: 'Acme Corp', mergedFrom: ['Acme Corp'] },
            ],
          }),
        },
      },
    ],
  });

  const result = await deduplicateEntities(entities);

  expect(result).toHaveLength(2);
  expect(result[0].name).toBe('John Doe');
  expect(result[0].sources).toHaveLength(2);
  expect(result[0].sources).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ snippet: 'John Doe on page 2', page: 2, chunkIndex: 0 }),
      expect.objectContaining({ snippet: 'J. Doe signed on page 17', page: 17, chunkIndex: 3 }),
    ]),
  );
  expect(result[1].sources).toHaveLength(1);
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx jest test/processing/pipeline/dedup-entities.step.spec.ts --no-cache
```

Expected: FAIL — current `deduplicateEntities` returns no `sources` field.

- [x] **Step 3: Implement source collection in dedup step**

In `src/processing/pipeline/steps/dedup-entities.step.ts`, update the function signature and add source collection after the LLM call:

```typescript
import { ExtractedEntity, DedupedEntity, EntitySourceData } from '../pipeline.types';

// ... existing code ...

export async function deduplicateEntities(
  entities: ExtractedEntity[],
): Promise<DedupedEntity[]> {
  if (entities.length === 0) return [];

  // ... existing LLM call code ...

  try {
    // ... existing retry/LLM code stays the same ...
    const json = JSON.parse(response.choices[0].message.content as string);
    const rawDeduped = json.entities as { typeName: string; name: string; mergedFrom: string[] }[];

    return rawDeduped.map((d) => ({
      ...d,
      sources: collectSources(d.mergedFrom, d.typeName, entities),
    }));
  } catch {
    return toFallback(entities);
  }
}

function collectSources(
  mergedFrom: string[],
  typeName: string,
  allEntities: ExtractedEntity[],
): EntitySourceData[] {
  return allEntities
    .filter((e) => e.typeName === typeName && mergedFrom.includes(e.name))
    .map((e) => ({
      snippet: e.sourceSnippet,
      page: e.sourcePage,
      cell: e.sourceCell,
      chunkIndex: e.chunkIndex,
    }));
}
```

Update `toFallback` to include sources:

```typescript
function toFallback(entities: ExtractedEntity[]): DedupedEntity[] {
  return entities.map((e) => ({
    typeName: e.typeName,
    name: e.name,
    mergedFrom: [e.name],
    sources: [{
      snippet: e.sourceSnippet,
      page: e.sourcePage,
      cell: e.sourceCell,
      chunkIndex: e.chunkIndex,
    }],
  }));
}
```

- [x] **Step 4: Update all existing dedup tests**

All existing tests need `ExtractedEntity` inputs updated with source fields, and assertions updated to check `sources` on the output. The `'falls back to raw entities'` test should verify fallback includes sources.

- [x] **Step 5: Run tests**

```bash
npx jest test/processing/pipeline/dedup-entities.step.spec.ts --no-cache
```

Expected: All PASS.

- [x] **Step 6: Commit**

```bash
git add src/processing/pipeline/steps/dedup-entities.step.ts test/processing/pipeline/dedup-entities.step.spec.ts
git commit -m "feat: preserve source provenance through entity dedup"
```

---

### Task 6: Fact-Entity Linking Step

**Files:**
- Create: `src/processing/pipeline/steps/link-facts-to-entities.step.ts`
- Create: `test/processing/pipeline/link-facts-to-entities.step.spec.ts`

- [x] **Step 1: Write the tests**

Create `test/processing/pipeline/link-facts-to-entities.step.spec.ts`:

```typescript
import { linkFactsToEntities } from '../../../src/processing/pipeline/steps/link-facts-to-entities.step';
import { DedupedEntity, ExtractedFact } from '../../../src/processing/pipeline/pipeline.types';

const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

describe('linkFactsToEntities', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('links facts to entities using source snippets', async () => {
    const facts: ExtractedFact[] = [
      { typeName: 'monetary_amount', value: '$150,000', sourceSnippet: "John Doe's salary is $150,000", sourcePage: 5 },
    ];
    const entities: DedupedEntity[] = [
      { typeName: 'person', name: 'John Doe', mergedFrom: ['John Doe'], sources: [] },
      { typeName: 'person', name: 'Jane Smith', mergedFrom: ['Jane Smith'], sources: [] },
    ];
    const hints: Record<string, string> = { monetary_amount: 'often related to person or organization' };

    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            links: [{ factIndex: 0, entityNames: ['John Doe'], entityTypes: ['person'] }],
          }),
        },
      }],
    });

    const result = await linkFactsToEntities(facts, entities, hints);

    expect(result).toEqual([
      { factIndex: 0, entityNames: ['John Doe'], entityTypes: ['person'] },
    ]);
  });

  it('returns empty links when no facts provided', async () => {
    const result = await linkFactsToEntities([], [{ typeName: 'person', name: 'X', mergedFrom: ['X'], sources: [] }], {});
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns empty links when no entities provided', async () => {
    const result = await linkFactsToEntities(
      [{ typeName: 'monetary_amount', value: '$100', sourceSnippet: 'text' }],
      [],
      {},
    );
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns empty links on LLM failure (graceful degradation)', async () => {
    jest.useFakeTimers();

    const facts: ExtractedFact[] = [
      { typeName: 'monetary_amount', value: '$100', sourceSnippet: 'some text' },
    ];
    const entities: DedupedEntity[] = [
      { typeName: 'person', name: 'Bob', mergedFrom: ['Bob'], sources: [] },
    ];

    mockCreate.mockRejectedValue(new Error('API down'));

    const resultPromise = linkFactsToEntities(facts, entities, {});
    await jest.advanceTimersByTimeAsync(15_000);
    const result = await resultPromise;

    expect(result).toEqual([]);

    jest.useRealTimers();
  });

  it('uses structured output schema', async () => {
    const facts: ExtractedFact[] = [
      { typeName: 'monetary_amount', value: '$100', sourceSnippet: 'text' },
    ];
    const entities: DedupedEntity[] = [
      { typeName: 'person', name: 'Bob', mergedFrom: ['Bob'], sources: [] },
    ];

    mockCreate.mockResolvedValue({
      choices: [{
        message: { content: JSON.stringify({ links: [] }) },
      }],
    });

    await linkFactsToEntities(facts, entities, {});

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: expect.objectContaining({ type: 'json_schema' }),
      }),
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx jest test/processing/pipeline/link-facts-to-entities.step.spec.ts --no-cache
```

Expected: FAIL — module not found.

- [x] **Step 3: Implement the linking step**

Create `src/processing/pipeline/steps/link-facts-to-entities.step.ts`:

```typescript
import OpenAI from 'openai';
import { ExtractedFact, DedupedEntity, LinkingResult } from '../pipeline.types';
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
            entityNames: { type: 'array', items: { type: 'string' } },
            entityTypes: { type: 'array', items: { type: 'string' } },
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

function buildPrompt(
  facts: ExtractedFact[],
  entities: DedupedEntity[],
  hints: Record<string, string>,
): string {
  const factsBlock = facts
    .map((f, i) => {
      const hint = hints[f.typeName];
      const hintLine = hint ? `\n  Hint: ${hint}` : '';
      return `[${i}] Type: "${f.typeName}", Value: "${f.value}"\n  Source: "${f.sourceSnippet}"${hintLine}`;
    })
    .join('\n');

  const entitiesBlock = entities
    .map((e) => `- "${e.name}" (${e.typeName})`)
    .join('\n');

  return `You are a fact-entity linking assistant. For each fact below, determine which entities (if any) it relates to, based on the source text where the fact was found.

FACTS:
${factsBlock}

ENTITIES:
${entitiesBlock}

RULES:
- Use the "Source" text to determine which entities the fact is about
- A fact may relate to zero, one, or many entities
- Only link to entities listed above — do not invent entity names
- For each link, return the factIndex, and the entityNames and entityTypes arrays (same length, matched by position)
- If a fact relates to no entities, omit it from the links array`;
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
          response_format: { type: 'json_schema', json_schema: linkingJsonSchema },
          messages: [{ role: 'user', content: buildPrompt(facts, entities, hints) }],
        }),
      { retries: 3, backoffMs: 2000, backoffType: 'exponential' },
    );

    const json = JSON.parse(response.choices[0].message.content as string);
    return json.links as LinkingResult[];
  } catch {
    return [];
  }
}
```

- [x] **Step 4: Run tests**

```bash
npx jest test/processing/pipeline/link-facts-to-entities.step.spec.ts --no-cache
```

Expected: All PASS.

- [x] **Step 5: Commit**

```bash
git add src/processing/pipeline/steps/link-facts-to-entities.step.ts test/processing/pipeline/link-facts-to-entities.step.spec.ts
git commit -m "feat: add fact-entity linking pipeline step"
```

---

### Task 7: Workflow Events and Wiring

**Files:**
- Modify: `src/processing/pipeline/workflow-events.ts`
- Modify: `src/processing/pipeline/create-extraction-workflow.ts`
- Modify: `src/processing/pipeline/extraction.workflow.ts`
- Test: `test/processing/pipeline/extraction.workflow.spec.ts`

- [x] **Step 1: Update workflow events**

In `src/processing/pipeline/workflow-events.ts`:

Add import for `LinkingResult`:
```typescript
import {
  ParsedDocument,
  DocumentChunk,
  ExtractionTaskResult,
  DedupedEntity,
  ExtractedEntity,
  ExtractedFact,
  LinkingResult,
} from './pipeline.types';
```

Update `ExtractionCollectedData` to carry full `ExtractedEntity[]` (with sources) instead of bare `{ typeName, name }`:
```typescript
export interface ExtractionCollectedData {
  entities: ExtractedEntity[];
  facts: ExtractedFact[];
  failures: { chunkIndex: number; typeName: string; kind: string; error: string }[];
}
```

Add `LinkingCompleteData` and its event:
```typescript
export interface LinkingCompleteData {
  entities: DedupedEntity[];
  facts: ExtractedFact[];
  links: LinkingResult[];
  failures: { chunkIndex: number; typeName: string; kind: string; error: string }[];
}

export const linkingCompleteEvent = workflowEvent<LinkingCompleteData>({
  debugLabel: 'linkingComplete',
});
```

Update `PersistData` to include links:
```typescript
export interface PersistData {
  entities: DedupedEntity[];
  facts: ExtractedFact[];
  links: LinkingResult[];
  failures: { chunkIndex: number; typeName: string; kind: string; error: string }[];
}
```

- [x] **Step 2: Update ExtractionWorkflowState**

In `src/processing/pipeline/create-extraction-workflow.ts`, update the state interface to include `entityLinkHints`:

```typescript
export interface ExtractionWorkflowState {
  documentId: string;
  prisma: PrismaService;
  entityTypes: { name: string; description: string; prompt: string }[];
  factTypes: { name: string; description: string; prompt: string; entityLinkHint?: string }[];
  expectedResultCount: number;
  collectedResults: ExtractionTaskResult[];
}
```

- [x] **Step 3: Update fan-out to pass chunkIndex**

In the `extractionTaskEvent` handler (Step 3 of the workflow), update entity extraction call to pass `chunkIndex`:

```typescript
if (kind === 'entity') {
  const entities = await extractEntityType(chunk.text, {
    name: typeName,
    prompt: typePrompt,
  }, chunk.chunkIndex);
```

- [x] **Step 4: Wire the linking step between dedup and persist**

Import the new step and event:
```typescript
import { linkFactsToEntities } from './steps/link-facts-to-entities.step';
import { linkingCompleteEvent } from './workflow-events';
```

Change the dedup handler to emit `dedupCompleteEvent` as before (no change needed there).

Add a new handler after dedup that does linking:
```typescript
// Step 5b: Link facts to entities
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
```

Update the persist handler to listen to `linkingCompleteEvent` instead of `dedupCompleteEvent`:
```typescript
// Step 6: Persist results
workflow.handle([linkingCompleteEvent], async (context, event) => {
  const { state } = context;
  const { entities, facts, links, failures } = event.data;

  await withRetry(
    () => persistResults(state.prisma, state.documentId, entities, facts, links),
    { retries: 2, backoffMs: 500, backoffType: 'fixed' },
  );
  // ... rest stays the same
```

- [x] **Step 5: Update extraction.workflow.ts to pass entityLinkHint**

In `src/processing/pipeline/extraction.workflow.ts`, update the factTypesDef mapping:

```typescript
const factTypesDef = factTypes.map((ft) => ({
  name: ft.name,
  description: ft.description,
  prompt: ft.prompt,
  entityLinkHint: ft.entityLinkHint ?? undefined,
}));
```

This requires `getFactTypes()` to return the `entityLinkHint` field. Since `CatalogService.getFactTypes()` calls `prisma.factType.findMany()`, Prisma already includes all columns — no change needed in the service.

- [x] **Step 6: Update workflow integration test**

In `test/processing/pipeline/extraction.workflow.spec.ts`, add the mock for `link-facts-to-entities.step`:

```typescript
jest.mock('../../../src/processing/pipeline/steps/link-facts-to-entities.step');
import { linkFactsToEntities } from '../../../src/processing/pipeline/steps/link-facts-to-entities.step';
```

Update the mock data to include source fields and the new linking mock:

```typescript
const mockEntities = [{ typeName: 'person', name: 'Bob', sourceSnippet: 'Bob was there', sourcePage: 1, sourceCell: undefined, chunkIndex: 0 }];
const mockFacts = [{ typeName: 'monetary_amount', value: '$100', sourceSnippet: 'cost is $100', sourcePage: 2, sourceCell: undefined }];
const mockDeduped = [
  { typeName: 'person', name: 'Bob', mergedFrom: ['Bob'], sources: [{ snippet: 'Bob was there', page: 1, chunkIndex: 0 }] },
];
const mockLinks = [{ factIndex: 0, entityNames: ['Bob'], entityTypes: ['person'] }];

// ... in test setup:
(linkFactsToEntities as jest.Mock).mockResolvedValue(mockLinks);
```

Update the `persistResults` assertion to include links:
```typescript
expect(persistResults).toHaveBeenCalledWith(
  expect.anything(),
  'wf-doc-1',
  mockDeduped,
  mockFacts,
  mockLinks,
);
```

- [x] **Step 7: Run tests**

```bash
npx jest test/processing/pipeline/extraction.workflow.spec.ts --no-cache
```

Expected: All PASS.

- [x] **Step 8: Commit**

```bash
git add src/processing/pipeline/workflow-events.ts src/processing/pipeline/create-extraction-workflow.ts src/processing/pipeline/extraction.workflow.ts test/processing/pipeline/extraction.workflow.spec.ts
git commit -m "feat: wire linking step into extraction workflow"
```

---

### Task 8: Persist Updates (Upsert, Sources, Links)

**Files:**
- Modify: `src/processing/pipeline/steps/persist-results.step.ts`
- Test: `test/processing/pipeline/persist-results.step.spec.ts`

- [x] **Step 1: Write failing test for entity upsert**

In `test/processing/pipeline/persist-results.step.spec.ts`, add:

```typescript
it('reuses existing entity when (entityTypeId, name) matches', async () => {
  const et = await prisma.entityType.create({
    data: { name: 'person', description: 'A person', prompt: 'Extract.' },
  });
  const existingEntity = await prisma.entity.create({
    data: { entityTypeId: et.id, name: 'Bob Smith' },
  });
  const doc1 = await prisma.document.create({
    data: { id: 'doc-upsert-1', filename: 'a.pdf', mimeType: 'application/pdf', filePath: '/tmp/a.pdf', status: 'processing' },
  });
  await prisma.documentEntity.create({
    data: { documentId: doc1.id, entityId: existingEntity.id },
  });

  const doc2 = await prisma.document.create({
    data: { id: 'doc-upsert-2', filename: 'b.pdf', mimeType: 'application/pdf', filePath: '/tmp/b.pdf', status: 'processing' },
  });

  const entities: DedupedEntity[] = [
    { typeName: 'person', name: 'Bob Smith', mergedFrom: ['Bob Smith'], sources: [{ snippet: 'Bob Smith in doc B', page: 1, chunkIndex: 0 }] },
  ];

  await persistResults(prisma, doc2.id, entities, [], []);

  const allEntities = await prisma.entity.findMany({ where: { name: 'Bob Smith' } });
  expect(allEntities).toHaveLength(1);
  expect(allEntities[0].id).toBe(existingEntity.id);

  const links = await prisma.documentEntity.findMany({ where: { entityId: existingEntity.id } });
  expect(links).toHaveLength(2);
});
```

- [x] **Step 2: Write failing test for EntitySource creation**

```typescript
it('creates EntitySource records for each entity source', async () => {
  await prisma.entityType.create({
    data: { name: 'person', description: 'A person', prompt: 'Extract.' },
  });
  const doc = await prisma.document.create({
    data: { id: 'doc-sources', filename: 'a.pdf', mimeType: 'application/pdf', filePath: '/tmp/a.pdf', status: 'processing' },
  });

  const entities: DedupedEntity[] = [
    {
      typeName: 'person', name: 'John Doe', mergedFrom: ['John Doe', 'J. Doe'],
      sources: [
        { snippet: 'John Doe on page 2', page: 2, chunkIndex: 0 },
        { snippet: 'J. Doe signed on page 17', page: 17, chunkIndex: 3 },
      ],
    },
  ];

  await persistResults(prisma, doc.id, entities, [], []);

  const entity = await prisma.entity.findFirst({ where: { name: 'John Doe' } });
  const sources = await prisma.entitySource.findMany({ where: { entityId: entity!.id } });
  expect(sources).toHaveLength(2);
  expect(sources).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ snippet: 'John Doe on page 2', page: 2, chunkIndex: 0 }),
      expect.objectContaining({ snippet: 'J. Doe signed on page 17', page: 17, chunkIndex: 3 }),
    ]),
  );
});
```

- [x] **Step 3: Write failing test for fact source columns**

```typescript
it('saves sourceSnippet, sourcePage, sourceCell on facts', async () => {
  await prisma.factType.create({
    data: { name: 'monetary_amount', description: 'Money', prompt: 'Extract.' },
  });
  const doc = await prisma.document.create({
    data: { id: 'doc-fact-src', filename: 'a.pdf', mimeType: 'application/pdf', filePath: '/tmp/a.pdf', status: 'processing' },
  });

  const facts: ExtractedFact[] = [
    { typeName: 'monetary_amount', value: 'EUR 50,000', sourceSnippet: 'The salary is EUR 50,000', sourcePage: 3, sourceCell: undefined },
  ];

  await persistResults(prisma, doc.id, [], facts, []);

  const savedFact = await prisma.fact.findFirst();
  expect(savedFact!.sourceSnippet).toBe('The salary is EUR 50,000');
  expect(savedFact!.sourcePage).toBe(3);
  expect(savedFact!.sourceCell).toBeNull();
});
```

- [x] **Step 4: Write failing test for FactEntity junction**

```typescript
it('creates FactEntity records from linking results', async () => {
  await prisma.entityType.create({
    data: { name: 'person', description: 'A person', prompt: 'Extract.' },
  });
  await prisma.factType.create({
    data: { name: 'monetary_amount', description: 'Money', prompt: 'Extract.' },
  });
  const doc = await prisma.document.create({
    data: { id: 'doc-link', filename: 'a.pdf', mimeType: 'application/pdf', filePath: '/tmp/a.pdf', status: 'processing' },
  });

  const entities: DedupedEntity[] = [
    { typeName: 'person', name: 'Bob', mergedFrom: ['Bob'], sources: [{ snippet: 'Bob', chunkIndex: 0 }] },
  ];
  const facts: ExtractedFact[] = [
    { typeName: 'monetary_amount', value: '$100', sourceSnippet: "Bob's salary is $100" },
  ];
  const links = [{ factIndex: 0, entityNames: ['Bob'], entityTypes: ['person'] }];

  await persistResults(prisma, doc.id, entities, facts, links);

  const factEntity = await prisma.factEntity.findMany();
  expect(factEntity).toHaveLength(1);

  const fact = await prisma.fact.findFirst();
  const entity = await prisma.entity.findFirst();
  expect(factEntity[0].factId).toBe(fact!.id);
  expect(factEntity[0].entityId).toBe(entity!.id);
});
```

- [x] **Step 5: Run tests to verify they fail**

```bash
npx jest test/processing/pipeline/persist-results.step.spec.ts --no-cache
```

Expected: FAIL (multiple failures — new signature, missing tables in schema if migration not applied).

- [x] **Step 6: Implement updated persistResults**

Rewrite `src/processing/pipeline/steps/persist-results.step.ts`:

```typescript
import { PrismaService } from '../../../prisma/prisma.service';
import { DedupedEntity, ExtractedFact, LinkingResult } from '../pipeline.types';

export async function persistResults(
  prisma: PrismaService,
  documentId: string,
  entities: DedupedEntity[],
  facts: ExtractedFact[],
  links: LinkingResult[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const entityIdMap = new Map<string, string>();

    for (const entity of entities) {
      const entityType = await tx.entityType.findUnique({
        where: { name: entity.typeName },
      });
      if (!entityType) continue;

      const existing = await tx.entity.findUnique({
        where: { entityTypeId_name: { entityTypeId: entityType.id, name: entity.name } },
      });

      const entityId = existing
        ? existing.id
        : (await tx.entity.create({ data: { entityTypeId: entityType.id, name: entity.name } })).id;

      entityIdMap.set(`${entity.typeName}:${entity.name}`, entityId);

      const existingLink = await tx.documentEntity.findUnique({
        where: { documentId_entityId: { documentId, entityId } },
      });
      if (!existingLink) {
        await tx.documentEntity.create({ data: { documentId, entityId } });
      }

      for (const source of entity.sources) {
        await tx.entitySource.create({
          data: {
            entityId,
            snippet: source.snippet,
            page: source.page ?? null,
            cell: source.cell ?? null,
            chunkIndex: source.chunkIndex,
          },
        });
      }
    }

    const factIds: string[] = [];

    for (const fact of facts) {
      const factType = await tx.factType.findUnique({
        where: { name: fact.typeName },
      });
      if (!factType) {
        factIds.push('');
        continue;
      }

      const created = await tx.fact.create({
        data: {
          factTypeId: factType.id,
          value: fact.value,
          sourceSnippet: fact.sourceSnippet || '',
          sourcePage: fact.sourcePage ?? null,
          sourceCell: fact.sourceCell ?? null,
        },
      });

      factIds.push(created.id);

      await tx.documentFact.create({
        data: { documentId, factId: created.id },
      });
    }

    for (const link of links) {
      const factId = factIds[link.factIndex];
      if (!factId) continue;

      for (let i = 0; i < link.entityNames.length; i++) {
        const entityName = link.entityNames[i];
        const entityType = link.entityTypes[i];
        const entityId = entityIdMap.get(`${entityType}:${entityName}`);
        if (!entityId) continue;

        const existingFactEntity = await tx.factEntity.findUnique({
          where: { factId_entityId: { factId, entityId } },
        });
        if (!existingFactEntity) {
          await tx.factEntity.create({ data: { factId, entityId } });
        }
      }
    }
  });
}
```

- [x] **Step 7: Update existing tests to match new signature**

All existing tests in `persist-results.step.spec.ts` call `persistResults(prisma, docId, entities, facts)` — add the fifth `links` parameter (pass `[]` for existing tests). Update `beforeEach` cleanup to include new tables:

```typescript
beforeEach(async () => {
  await prisma.factEntity.deleteMany();
  await prisma.entitySource.deleteMany();
  await prisma.documentEntity.deleteMany();
  await prisma.documentFact.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.fact.deleteMany();
  await prisma.document.deleteMany();
  await prisma.entityType.deleteMany();
  await prisma.factType.deleteMany();
});
```

- [x] **Step 8: Run all persist tests**

```bash
npx jest test/processing/pipeline/persist-results.step.spec.ts --no-cache
```

Expected: All PASS.

- [x] **Step 9: Commit**

```bash
git add src/processing/pipeline/steps/persist-results.step.ts test/processing/pipeline/persist-results.step.spec.ts
git commit -m "feat: persist with entity upsert, sources, fact source columns, and fact-entity links"
```

---

### Task 9: Catalog CRUD API

**Files:**
- Modify: `src/catalog/catalog.dto.ts`
- Modify: `src/catalog/catalog.service.ts`
- Modify: `src/catalog/catalog.controller.ts`
- Test: `test/catalog/catalog.controller.spec.ts`

- [x] **Step 1: Write failing tests for POST and DELETE**

In `test/catalog/catalog.controller.spec.ts`, add:

```typescript
describe('POST /catalog/entity-types', () => {
  it('creates a new entity type', async () => {
    const response = await request(app.getHttpServer())
      .post('/catalog/entity-types')
      .send({ name: 'vehicle', description: 'A vehicle', prompt: 'Extract vehicles.' })
      .expect(201);

    expect(response.body).toMatchObject({
      name: 'vehicle',
      description: 'A vehicle',
      prompt: 'Extract vehicles.',
    });
    expect(response.body.id).toBeDefined();
  });

  it('rejects duplicate name with 409', async () => {
    await request(app.getHttpServer())
      .post('/catalog/entity-types')
      .send({ name: 'person', description: 'dup', prompt: 'dup' })
      .expect(409);
  });

  it('rejects missing fields with 400', async () => {
    await request(app.getHttpServer())
      .post('/catalog/entity-types')
      .send({ name: 'incomplete' })
      .expect(400);
  });
});

describe('DELETE /catalog/entity-types/:id', () => {
  it('deletes entity type and cascades', async () => {
    await request(app.getHttpServer())
      .delete('/catalog/entity-types/et-1')
      .expect(204);

    const remaining = await prisma.entityType.findUnique({ where: { id: 'et-1' } });
    expect(remaining).toBeNull();
  });

  it('returns 404 for non-existent id', async () => {
    await request(app.getHttpServer())
      .delete('/catalog/entity-types/nonexistent')
      .expect(404);
  });
});

describe('POST /catalog/fact-types', () => {
  it('creates with entityLinkHint', async () => {
    const response = await request(app.getHttpServer())
      .post('/catalog/fact-types')
      .send({
        name: 'salary',
        description: 'Salary',
        prompt: 'Extract salaries.',
        entityLinkHint: 'often related to person',
      })
      .expect(201);

    expect(response.body.entityLinkHint).toBe('often related to person');
  });

  it('creates without entityLinkHint', async () => {
    const response = await request(app.getHttpServer())
      .post('/catalog/fact-types')
      .send({ name: 'gdp', description: 'GDP', prompt: 'Extract GDP.' })
      .expect(201);

    expect(response.body.entityLinkHint).toBeNull();
  });
});

describe('DELETE /catalog/fact-types/:id', () => {
  it('deletes fact type', async () => {
    await request(app.getHttpServer())
      .delete('/catalog/fact-types/ft-1')
      .expect(204);

    const remaining = await prisma.factType.findUnique({ where: { id: 'ft-1' } });
    expect(remaining).toBeNull();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
npx jest test/catalog/catalog.controller.spec.ts --no-cache
```

Expected: FAIL (404 for POST endpoints, methods not found).

- [x] **Step 3: Add DTOs**

In `src/catalog/catalog.dto.ts`:

```typescript
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateCatalogTypeDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  prompt?: string;
}

export class CreateEntityTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  prompt: string;
}

export class CreateFactTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsOptional()
  @IsString()
  entityLinkHint?: string;
}
```

- [x] **Step 4: Add service methods**

In `src/catalog/catalog.service.ts`, add:

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';

// ... existing methods ...

async createEntityType(data: { name: string; description: string; prompt: string }) {
  const existing = await this.prisma.entityType.findUnique({ where: { name: data.name } });
  if (existing) throw new ConflictException(`EntityType "${data.name}" already exists`);
  return this.prisma.entityType.create({ data });
}

async deleteEntityType(id: string) {
  const existing = await this.prisma.entityType.findUnique({ where: { id } });
  if (!existing) throw new NotFoundException(`EntityType ${id} not found`);
  await this.prisma.entityType.delete({ where: { id } });
}

async createFactType(data: { name: string; description: string; prompt: string; entityLinkHint?: string }) {
  const existing = await this.prisma.factType.findUnique({ where: { name: data.name } });
  if (existing) throw new ConflictException(`FactType "${data.name}" already exists`);
  return this.prisma.factType.create({ data: { ...data, entityLinkHint: data.entityLinkHint ?? null } });
}

async deleteFactType(id: string) {
  const existing = await this.prisma.factType.findUnique({ where: { id } });
  if (!existing) throw new NotFoundException(`FactType ${id} not found`);
  await this.prisma.factType.delete({ where: { id } });
}
```

- [x] **Step 5: Add controller endpoints**

In `src/catalog/catalog.controller.ts`:

```typescript
import { Controller, Get, Put, Post, Delete, Param, Body, HttpCode } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { UpdateCatalogTypeDto, CreateEntityTypeDto, CreateFactTypeDto } from './catalog.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  async getCatalog() {
    return this.catalogService.getCatalog();
  }

  @Post('entity-types')
  @HttpCode(201)
  async createEntityType(@Body() dto: CreateEntityTypeDto) {
    return this.catalogService.createEntityType(dto);
  }

  @Put('entity-types/:id')
  async updateEntityType(@Param('id') id: string, @Body() dto: UpdateCatalogTypeDto) {
    return this.catalogService.updateEntityType(id, dto);
  }

  @Delete('entity-types/:id')
  @HttpCode(204)
  async deleteEntityType(@Param('id') id: string) {
    await this.catalogService.deleteEntityType(id);
  }

  @Post('fact-types')
  @HttpCode(201)
  async createFactType(@Body() dto: CreateFactTypeDto) {
    return this.catalogService.createFactType(dto);
  }

  @Put('fact-types/:id')
  async updateFactType(@Param('id') id: string, @Body() dto: UpdateCatalogTypeDto) {
    return this.catalogService.updateFactType(id, dto);
  }

  @Delete('fact-types/:id')
  @HttpCode(204)
  async deleteFactType(@Param('id') id: string) {
    await this.catalogService.deleteFactType(id);
  }
}
```

- [x] **Step 6: Run tests**

```bash
npx jest test/catalog/catalog.controller.spec.ts --no-cache
```

Expected: All PASS.

- [x] **Step 7: Commit**

```bash
git add src/catalog/catalog.dto.ts src/catalog/catalog.service.ts src/catalog/catalog.controller.ts test/catalog/catalog.controller.spec.ts
git commit -m "feat: add catalog CRUD endpoints (create/delete entity types and fact types)"
```

---

### Task 10: Extractions API Update

**Files:**
- Modify: `src/extractions/extractions.service.ts`
- Test: `test/extractions/extractions.controller.spec.ts`

- [x] **Step 1: Write failing test for enriched response**

In `test/extractions/extractions.controller.spec.ts`, add a test that expects source provenance and fact-entity links in the response. The test should seed entities with EntitySource records, facts with source columns, and FactEntity links, then verify the API returns them.

- [x] **Step 2: Run test to verify it fails**

```bash
npx jest test/extractions/extractions.controller.spec.ts --no-cache
```

- [x] **Step 3: Update ExtractionsService**

In `src/extractions/extractions.service.ts`, update `getGroupedExtractions` to include source provenance and fact-entity links:

```typescript
async getGroupedExtractions() {
  const [entityTypes, factTypes, documents] = await Promise.all([
    this.prisma.entityType.findMany({
      include: {
        entities: {
          include: {
            documents: {
              include: { document: { select: { id: true, filename: true } } },
            },
            sources: true,
            facts: {
              include: { fact: { select: { id: true } } },
            },
          },
        },
      },
    }),
    this.prisma.factType.findMany({
      include: {
        facts: {
          include: {
            documents: {
              include: { document: { select: { id: true, filename: true } } },
            },
            entities: {
              include: { entity: { select: { id: true, name: true, entityTypeId: true } } },
            },
          },
        },
      },
    }),
    this.prisma.document.findMany({
      select: { id: true, filename: true, status: true },
    }),
  ]);

  const entities = entityTypes
    .filter((et) => et.entities.length > 0)
    .map((et) => ({
      type: et.name,
      items: et.entities.map((e) => ({
        id: e.id,
        name: e.name,
        documents: e.documents.map((de) => ({
          id: de.document.id,
          filename: de.document.filename,
        })),
        sources: e.sources.map((s) => ({
          snippet: s.snippet,
          page: s.page,
          cell: s.cell,
          chunkIndex: s.chunkIndex,
        })),
        linkedFactIds: e.facts.map((fe) => fe.fact.id),
      })),
    }));

  const facts = factTypes
    .filter((ft) => ft.facts.length > 0)
    .map((ft) => ({
      type: ft.name,
      items: ft.facts.map((f) => ({
        id: f.id,
        value: f.value,
        sourceSnippet: f.sourceSnippet,
        sourcePage: f.sourcePage,
        sourceCell: f.sourceCell,
        documents: f.documents.map((df) => ({
          id: df.document.id,
          filename: df.document.filename,
        })),
        linkedEntities: f.entities.map((fe) => ({
          id: fe.entity.id,
          name: fe.entity.name,
        })),
      })),
    }));

  return { entities, facts, documents };
}
```

- [x] **Step 4: Run tests**

```bash
npx jest test/extractions/extractions.controller.spec.ts --no-cache
```

Expected: All PASS.

- [x] **Step 5: Commit**

```bash
git add src/extractions/extractions.service.ts test/extractions/extractions.controller.spec.ts
git commit -m "feat: include source provenance and fact-entity links in extractions API"
```

---

### Task 11: Frontend — API Client Updates

**Files:**
- Modify: `frontend/src/api.ts`

- [x] **Step 1: Add CRUD functions and update types**

In `frontend/src/api.ts`, add:

```typescript
export interface EntitySource {
  snippet: string;
  page: number | null;
  cell: string | null;
  chunkIndex: number;
}

export interface LinkedEntity {
  id: string;
  name: string;
}

export interface ExtractionItem {
  id: string;
  name: string;
  documents: Array<{ id: string; filename: string }>;
  sources: EntitySource[];
  linkedFactIds: string[];
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

export function createEntityType(data: { name: string; description: string; prompt: string }) {
  return request('/catalog/entity-types', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteEntityType(id: string) {
  return request(`/catalog/entity-types/${id}`, { method: 'DELETE' });
}

export function createFactType(data: { name: string; description: string; prompt: string; entityLinkHint?: string }) {
  return request('/catalog/fact-types', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteFactType(id: string) {
  return request(`/catalog/fact-types/${id}`, { method: 'DELETE' });
}
```

- [x] **Step 2: Commit**

```bash
git add frontend/src/api.ts
git commit -m "feat: add catalog CRUD and enriched extraction types to frontend API"
```

---

### Task 12: Frontend — Catalog CRUD UI

**Files:**
- Modify: `frontend/src/tabs/CatalogTab.tsx`

- [x] **Step 1: Add create forms and delete buttons**

Update `CatalogTab` to add state for create forms, create/delete handlers, and UI. This is a UI task — no unit test; verify manually by running the dev server.

Add state:
```typescript
const [showCreateEntity, setShowCreateEntity] = useState(false);
const [showCreateFact, setShowCreateFact] = useState(false);
const [newEntityName, setNewEntityName] = useState('');
const [newEntityDesc, setNewEntityDesc] = useState('');
const [newEntityPrompt, setNewEntityPrompt] = useState('');
const [newFactName, setNewFactName] = useState('');
const [newFactDesc, setNewFactDesc] = useState('');
const [newFactPrompt, setNewFactPrompt] = useState('');
const [newFactHint, setNewFactHint] = useState('');
```

Add handlers:
```typescript
async function handleCreateEntity() {
  try {
    await createEntityType({ name: newEntityName, description: newEntityDesc, prompt: newEntityPrompt });
    setShowCreateEntity(false);
    setNewEntityName(''); setNewEntityDesc(''); setNewEntityPrompt('');
    await load();
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'Create failed');
  }
}

async function handleDelete(kind: 'entity' | 'fact', id: string, name: string) {
  if (!confirm(`Delete "${name}"? This will permanently remove all associated extractions.`)) return;
  try {
    if (kind === 'entity') await deleteEntityType(id);
    else await deleteFactType(id);
    await load();
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'Delete failed');
  }
}
```

Add "Create" button next to each section header and a delete button in each card header. Add an inline form that appears when `showCreateEntity`/`showCreateFact` is true.

- [x] **Step 2: Manual verification**

Start dev server (`cd frontend && npm run dev`), navigate to Catalog tab, verify:
- Create entity type form appears/submits
- Create fact type form with entityLinkHint field
- Delete button shows confirm dialog, deletes on confirm

- [x] **Step 3: Commit**

```bash
git add frontend/src/tabs/CatalogTab.tsx
git commit -m "feat: add create/delete UI to catalog tab"
```

---

### ~~Task 13: Frontend — Graph View~~ — DROPPED

> Feature was not implemented. `react-force-graph-2d` is installed but unused. `ExtractionsTab.tsx` exists on disk but is not routed in App.tsx.

---

### Task 14: Frontend — README Tab

**Files:**
- Create: `frontend/src/tabs/ReadmeTab.tsx`
- Modify: `frontend/src/App.tsx`

- [x] **Step 1: Copy workflow diagram to public**

```bash
cp /Users/eugeniogalioto/Freelancing/a.team/document-annotation-service/workflow-diagram.html /Users/eugeniogalioto/Freelancing/a.team/document-annotation-service/frontend/public/workflow-diagram.html
```

- [x] **Step 2: Create ReadmeTab component**

Create `frontend/src/tabs/ReadmeTab.tsx`:

```tsx
export function ReadmeTab() {
  return (
    <iframe
      src="/workflow-diagram.html"
      style={{
        width: '100%',
        height: 'calc(100vh - 60px)',
        border: 'none',
      }}
      title="Workflow Diagram"
    />
  );
}
```

- [x] **Step 3: Add README as first tab in App.tsx**

```tsx
import { ReadmeTab } from './tabs/ReadmeTab';

type Tab = 'readme' | 'documents' | 'catalog' | 'graph' | 'jobs' | 'improvements';

// In the nav (first button):
<button className={tab === 'readme' ? 'active' : ''} onClick={() => setTab('readme')}>README</button>
<button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}>Documents</button>
// ... rest of tabs

// In the content:
{tab === 'readme' && <ReadmeTab />}
```

Update the default tab to `'readme'`:
```tsx
const [tab, setTab] = useState<Tab>('readme');
```

- [x] **Step 4: Manual verification**

Start dev server, verify README tab is first, loads the workflow diagram in an iframe, scrolls and renders correctly.

- [x] **Step 5: Commit**

```bash
git add frontend/public/workflow-diagram.html frontend/src/tabs/ReadmeTab.tsx frontend/src/App.tsx
git commit -m "feat: add README tab with embedded workflow diagram"
```

---

### Task 15: Run Full Test Suite

**Files:** None (verification only)

- [x] **Step 1: Run all tests**

```bash
cd /Users/eugeniogalioto/Freelancing/a.team/document-annotation-service
npx jest --no-cache
```

Expected: All tests pass. If any fail, fix them before proceeding.

- [x] **Step 2: Manual end-to-end verification**

1. Start Redis: `docker compose up -d`
2. Start backend: `npm run start:dev`
3. Start frontend: `cd frontend && npm run dev`
4. Upload a document, wait for processing
5. Verify: Graph tab shows nodes and edges including fact-entity links
6. Verify: Catalog tab create/delete works
7. Verify: README tab shows workflow diagram

- [x] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: test suite and integration fixes"
```
