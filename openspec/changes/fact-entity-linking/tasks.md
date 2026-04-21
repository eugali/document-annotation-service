## 1. Schema Changes

All downstream work depends on this. One migration covering everything.

- [ ] 1.1 Add `sourceSnippet` (String), `sourcePage` (Int?), `sourceCell` (String?) columns to the `Fact` model
- [ ] 1.2 Add `entityLinkHint` (String?) column to the `FactType` model
- [ ] 1.3 Create `EntitySource` model (id, entityId FK, snippet, page?, cell?, chunkIndex) with `onDelete: Cascade` on the entity relation
- [ ] 1.4 Create `FactEntity` junction model (id, factId FK, entityId FK) with `onDelete: Cascade` on both FKs and `@@unique([factId, entityId])`
- [ ] 1.5 Add `onDelete: Cascade` to `Entity.entityType` and `Fact.factType` relations (currently missing — deletion of a type would FK-error today)
- [ ] 1.6 Add `@@unique([entityTypeId, name])` to `Entity` for cross-document sharing. Existing data may have duplicates from prior runs — the migration needs to deduplicate or the constraint will fail. Check for conflicts before applying.
- [ ] 1.7 Run `prisma migrate dev` to generate and apply the migration

## 2. Source Provenance in Extraction

The extraction steps (`extract-entities.step.ts`, `extract-facts.step.ts`) currently return bare `{ name }` / `{ value }` from the LLM. Adding source provenance means changing both the JSON schema sent to OpenAI and the types that flow through the entire pipeline. The tricky part is not the type changes — it's making the LLM reliably return verbatim snippets rather than paraphrasing or hallucinating them.

- [ ] 2.1 Update `ExtractedEntity` and `ExtractedFact` types in `pipeline.types.ts` to include `sourceSnippet`, `sourcePage?`, `sourceCell?`. `ExtractedEntity` also gets `chunkIndex`.
- [ ] 2.2 Update `entityJsonSchema` in `extract-entities.step.ts` to include `sourceSnippet` (string, required) and `sourcePage` (nullable int) in the structured output schema
- [ ] 2.3 Update entity extraction prompt to instruct the LLM to return the verbatim text passage where each entity was found. The prompt needs to be explicit: "copy the exact sentence(s), do not paraphrase."
- [ ] 2.4 Same for `factJsonSchema` and fact extraction prompt in `extract-facts.step.ts`
- [ ] 2.5 Update `ExtractionTaskResult` in `pipeline.types.ts` — the entities/facts it carries now include source fields
- [ ] 2.6 Update the fan-out step in `create-extraction-workflow.ts` — when building `extractionTaskEvent`, the chunk already carries `chunkIndex`. After extraction, attach `chunkIndex` to each `ExtractedEntity` before returning in `extractionResultEvent`.

## 3. Dedup Source Preservation

This is the least obvious part. The dedup LLM returns `{ typeName, name, mergedFrom[] }` — it doesn't know about sources. Source collection is a deterministic step that runs after the LLM call: match `mergedFrom` names back to the original `ExtractedEntity[]` to collect their snippets. The `deduplicateEntities` function currently takes `ExtractedEntity[]` and returns `DedupedEntity[]` — its signature must expand.

- [ ] 3.1 Update `DedupedEntity` type to include `sources: { snippet: string; page?: number; cell?: string; chunkIndex: number }[]`
- [ ] 3.2 Update `deduplicateEntities` in `dedup-entities.step.ts` to accept the full `ExtractedEntity[]` (with source fields) and after the LLM call, map each `mergedFrom` name back to the original extractions to collect their sources. Watch out: `mergedFrom` contains names, and the same name may appear multiple times across chunks (e.g., "John Doe" in chunk 0 and chunk 3) — collect all occurrences, not just the first match.
- [ ] 3.3 Update `ExtractionCollectedData` and `PersistData` in `workflow-events.ts` — the entity type in these interfaces must carry the new source fields through to the persist step

## 4. Fact-Entity Linking Pipeline Step

A new workflow step between dedup and persist. The current flow is `dedupCompleteEvent → persist handler`. After this change: `dedupCompleteEvent → linking handler → linkingCompleteEvent → persist handler`. The persist handler's trigger event changes — this is a wiring change in `create-extraction-workflow.ts`.

The linking prompt is where quality lives or dies. It gets all facts with their sourceSnippets and all canonical entities, and must figure out which facts relate to which entities. The source snippets are the primary signal. The `entityLinkHint` from the catalog is secondary context.

- [ ] 4.1 Create `LinkingResult` type: `{ factIndex: number; entityNames: string[]; entityTypes: string[] }[]`
- [ ] 4.2 Create `linkingCompleteEvent` in `workflow-events.ts` carrying entities, facts, links, and failures
- [ ] 4.3 Implement `link-facts-to-entities.step.ts` — loads `entityLinkHint` for each distinct fact type from the workflow state, builds prompt with indexed facts (value + sourceSnippet) and canonical entities (name + type), calls OpenAI with structured output schema, returns linking results. On empty facts or empty entities, skip the LLM call and return no links.
- [ ] 4.4 Wire into workflow: `dedupCompleteEvent` handler calls the linking step, emits `linkingCompleteEvent`. The persist handler now listens to `linkingCompleteEvent` instead of `dedupCompleteEvent`.
- [ ] 4.5 Add retry (3 retries, 2s/4s/8s exponential backoff). On total failure, emit `linkingCompleteEvent` with empty links — facts and entities are still persisted, just unlinked. This should not set the document to `partial` status.

## 5. Persist Updates

`persistResults` in `persist-results.step.ts` is currently 53 lines doing simple creates in a transaction. After this change it becomes the most complex step: upsert entities, create sources, save source fields on facts, create fact-entity links. Keep the transaction but expect this function to grow significantly — consider splitting into helper functions.

- [ ] 5.1 Update `persistResults` signature to accept linking results alongside entities and facts
- [ ] 5.2 Entity upsert: for each entity, query `Entity` by `(entityTypeId, name)`. If found, reuse it; if not, create. Then create `DocumentEntity` link. The `@@unique` constraint means concurrent jobs could race — wrap in try/catch and retry once on unique constraint violation.
- [ ] 5.3 Create `EntitySource` records for each entity's sources (both for newly created and for shared entities — new sources from the current document are always appended)
- [ ] 5.4 Save `sourceSnippet`, `sourcePage`, `sourceCell` on each `Fact` record during creation
- [ ] 5.5 Create `FactEntity` junction records from linking results. The linking step returns `entityNames[]` per fact — resolve these against the just-persisted entities by `(entityTypeId, name)` to get entity IDs. If a name doesn't resolve (LLM hallucinated an entity name), skip silently.

## 6. Catalog CRUD API

The controller (`catalog.controller.ts`) currently has `GET /` and `PUT /entity-types/:id` and `PUT /fact-types/:id`. Adding POST and DELETE. The cascade deletion is handled by Prisma via the `onDelete: Cascade` set in task 1.5 — the endpoints just call `prisma.entityType.delete()` / `prisma.factType.delete()` and Prisma handles the rest. Simple.

The one edge case: the seeder runs `onModuleInit` and upserts from `catalog.json`. If you delete a type via API and restart the server, the seeder recreates it. This is the existing behavior and not something to fix here, but worth noting.

- [ ] 6.1 Create `CreateEntityTypeDto` and `CreateFactTypeDto` (with `entityLinkHint?`) validation classes
- [ ] 6.2 Add `POST /api/catalog/entity-types` — validate, check name uniqueness (409 if taken), create, return 201
- [ ] 6.3 Add `DELETE /api/catalog/entity-types/:id` — find or 404, delete (cascades automatically), return 204
- [ ] 6.4 Add `POST /api/catalog/fact-types` — same pattern, include `entityLinkHint` in create
- [ ] 6.5 Add `DELETE /api/catalog/fact-types/:id` — same pattern

## 7. Extractions API Update

`ExtractionsService.getGroupedExtractions()` currently returns entities and facts grouped by type, each with their document links. The graph view needs a different shape: it needs documents as first-class nodes, fact-entity links, and source provenance. This may warrant a new endpoint or a significant reshape of the existing one. The current frontend-grouped format (entities by type, facts by type) doesn't map well to a graph — the graph needs a flat list of all nodes and edges.

- [ ] 7.1 Update `getGroupedExtractions` (or create a new `getGraphData` method) to include: all documents (id, filename, status), all entities (with sources from `EntitySource` and document IDs), all facts (with `sourceSnippet`, `sourcePage`, `sourceCell`, document IDs, and linked entity IDs from `FactEntity`)
- [ ] 7.2 Update the response types in the frontend `api.ts` to match the new shape

## 8. Frontend — Catalog CRUD UI

`CatalogTab` currently renders cards with description/prompt textareas and a Save button per type. Adding create and delete means adding a form (likely a modal or inline expandable) and a delete button per card. The `api.ts` already has `updateEntityType`/`updateFactType` — adding create/delete functions follows the same pattern.

- [ ] 8.1 Add `createEntityType`, `deleteEntityType`, `createFactType`, `deleteFactType` functions to `api.ts`
- [ ] 8.2 Add a "Create" button per section (entity types, fact types) that expands an inline form with name, description, prompt fields (and `entityLinkHint` for fact types). On submit, call the API and refresh the list.
- [ ] 8.3 Add a delete button per card with a confirmation dialog ("This will permanently delete all extracted [entities/facts] of this type. Continue?"). On confirm, call the API and refresh.

## 9. Frontend — Graph View

This is the largest frontend change. The current `ExtractionsTab` is ~100 lines rendering flat tables. The graph view is a fundamentally different component. Library choice matters — `react-force-graph-2d` is simpler (force-directed layout, canvas-based, handles hundreds of nodes), `@xyflow/react` is more feature-rich but heavier and layout-oriented. For an exploration/visualization use case, force-directed is more natural.

The data transformation is the real work: the API returns grouped entities/facts, but the graph needs `{ nodes: [...], edges: [...] }` with distinct node types and edge types.

- [ ] 9.1 Install graph visualization library
- [ ] 9.2 Create `GraphTab` component — fetches data from `/api/extractions`, transforms into nodes (documents, entities, facts with distinct colors/shapes) and edges (document↔entity, document↔fact, fact↔entity with distinct styles)
- [ ] 9.3 Add tooltips on hover: entity shows (type, name, documents, sources), fact shows (type, value, snippet, linked entities), document shows (filename, status, entity/fact counts)
- [ ] 9.4 Replace `ExtractionsTab` with `GraphTab` in `App.tsx`, rename tab label from "All Extractions" to "Graph"

## 10. Frontend — README Tab

Trivial and fully independent of everything else — can be done first or last.

- [ ] 10.1 Copy `workflow-diagram.html` to `frontend/public/` so Vite serves it as a static asset
- [ ] 10.2 Create `ReadmeTab` component — a borderless, full-height iframe pointing to `/workflow-diagram.html`
- [ ] 10.3 Add "README" as the first tab in `App.tsx` (before Documents) and render `ReadmeTab`
