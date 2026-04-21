## Context

The document-annotation-service is a NestJS microservice that extracts entities and facts from uploaded documents using a LlamaIndex workflow orchestrated by BullMQ. The current pipeline is: parse → chunk → fan-out extraction → fan-in → dedup entities → persist. Entities and facts are stored as flat, independent records with no provenance and no relationships between them. Entities are always created fresh per document, never shared.

Stack: NestJS 11, Prisma 7 (SQLite), BullMQ, OpenAI gpt-4o-mini, LlamaIndex workflow-core 1.3.3, Vite + React frontend.

The frontend has a tabbed layout: Documents, Catalog, All Extractions (flat tables), Jobs, Improvements. A standalone `workflow-diagram.html` exists outside the Vite app.

## Goals / Non-Goals

**Goals:**
- Track source provenance (snippet, page, cell) for every extracted entity and fact
- Link facts to entities in a many-to-many relationship via a post-dedup LLM step
- Share entities across documents by matching on (entityTypeId, name) during persist
- Allow creating and deleting entity types and fact types from the catalog with cascading deletion
- Replace the flat extractions table with an interactive graph visualization
- Embed the workflow diagram into the Vite app as a "Rationale" tab

**Non-Goals:**
- Global entity deduplication across documents (fuzzy matching "Acme Corp" vs "Acme Corporation" across different document runs — exact match only for now)
- Fact deduplication (duplicate fact values across chunks remain as separate records)
- Confidence scores on fact-entity links (can be added later as a column on the junction table)
- Real-time graph updates during processing
- Editing or renaming existing catalog types (only create and delete)
- Vector/embedding-based entity matching

## Decisions

### D1: Asymmetric source provenance — EntitySource table vs flat columns on Fact

**Choice:** Entities get a separate `EntitySource` table (1:N). Facts get flat `sourceSnippet`, `sourcePage?`, `sourceCell?` columns directly on the `Fact` model.

**Why:** Entity dedup merges multiple extractions into one canonical entity. "John Doe" extracted from page 2 and page 17 produces one entity with two sources. Facts are NOT deduped, so each fact has exactly one source — flat columns suffice.

**Alternative considered:** Separate `FactSource` table for symmetry. Rejected — adds a join with no benefit since the relationship is always 1:1.

### D2: Post-dedup LLM linking step using source snippets

**Choice:** A new pipeline step after entity dedup that makes a single LLM call with all facts (including their `sourceSnippet`) and all canonical entities, returning `{ links: [{ factIndex, entityNames[] }] }` via structured output.

**Why:** Source snippets provide the context the LLM needs to determine which specific entity a fact relates to (e.g., distinguishing between two people). Placing this after dedup ensures the LLM works with canonical entity names.

**Alternative considered:**
- Co-extraction (ask the LLM to name entities during fact extraction) — entity names would be pre-dedup, requiring fuzzy resolution.
- Linking without source context — ambiguous when multiple entities of the same type exist.
- Hybrid (extract raw hints, resolve deterministically post-dedup) — adds complexity for marginal gain.

### D3: Optional entityLinkHint on FactType

**Choice:** An optional free-text field on `FactType` that the human can fill to guide the linking LLM (e.g., "often related to person or organization"). Passed as prompt context during linking.

**Why:** The human defining the catalog may or may not know whether a fact type relates to entities. A free-text hint is flexible — it biases the LLM without constraining it. When absent, the LLM still attempts linking using source context alone.

**Alternative considered:**
- Boolean `linkedToEntities` flag — too rigid; can't express partial knowledge.
- Structured `linkedEntityTypes: string[]` — over-specified for the current stage where the catalog is small and evolving.

### D4: Cross-document entity sharing via exact match upsert

**Choice:** During persist, before creating a new Entity, check if one with the same `(entityTypeId, name)` already exists. If so, create only the `DocumentEntity` link.

**Why:** This is the simplest path to entity sharing. The schema already supports M:N (DocumentEntity is a junction table), but the persist step always created new records. Exact match avoids the complexity of fuzzy/LLM-based global dedup.

**Alternative considered:** LLM-based global dedup (comparing new extractions against all existing entities). Deferred — exact match covers the common case and avoids expensive cross-document LLM calls.

### D5: Cascading deletion for catalog types

**Choice:** Add `onDelete: Cascade` on `Entity.entityType` and `Fact.factType` relations in Prisma. When a type is deleted, all associated entities/facts and their junction records (`DocumentEntity`, `DocumentFact`, `EntitySource`, `FactEntity`) are automatically removed.

**Why:** The current schema lacks cascade on type→entity and type→fact relations (deletion would fail with FK constraint errors). Cascading is the correct semantic — if a type no longer exists, its extractions are meaningless.

**Alternative considered:** Soft delete (mark types as archived). Over-engineered for the current scope — the system is a prototype, and the catalog is expected to change frequently.

### D6: Graph visualization library

**Choice:** Use a lightweight, canvas-based graph library (e.g., `react-force-graph-2d` or `@xyflow/react`) embedded in the ExtractionsTab replacement. Nodes represent documents, entities, and facts with distinct visual styling. Edges represent relationships.

**Why:** The graph view needs to handle potentially hundreds of nodes (entities + facts across documents). A force-directed or flow-based layout naturally reveals clusters and relationships. Canvas rendering handles larger node counts than SVG.

**Alternative considered:** D3.js directly — more flexible but requires significantly more boilerplate for a React integration.

### D7: Rationale tab via iframe embedding

**Choice:** Embed `workflow-diagram.html` in a new `RationaleTab` component using an iframe pointing at the static file served by Vite.

**Why:** The workflow diagram is a self-contained HTML file with its own styles and layout. Inlining it into React would require converting all its CSS and DOM manipulation into React components. An iframe preserves it as-is with zero maintenance coupling.

**Alternative considered:** Converting the HTML to a React component. High effort, fragile (the diagram uses direct DOM manipulation), and the HTML may continue to evolve independently.

## Risks / Trade-offs

- **[Linking LLM context overflow]** Large documents may produce hundreds of facts and dozens of entities. The linking prompt could exceed context limits. → Mitigation: batch by fact type or by chunk of 50 facts if the total exceeds a threshold. Start without batching and add it if needed.

- **[Entity name collisions across documents]** Exact match on `(entityTypeId, name)` means "Washington" the person in doc A will be shared with "Washington" the person in doc B even if they refer to different people. → Mitigation: acceptable for now. The human can see which documents each entity appears in via the graph. Global dedup with disambiguation is a future enhancement.

- **[Cascade deletion data loss]** Deleting a catalog type removes all associated extractions irreversibly. → Mitigation: deletion UI requires explicit confirmation. No soft delete — this is a prototype system.

- **[Source snippet extraction quality]** The LLM must return meaningful source snippets during extraction. If snippets are too vague or truncated, the linking step loses context. → Mitigation: extraction prompts explicitly request the verbatim text passage where the entity/fact was found.

- **[Graph rendering performance]** Very large datasets (1000+ nodes) may make the graph slow or unreadable. → Mitigation: start with force-directed layout. Add filtering (by document, by type) if performance degrades. The current dataset is expected to be small (dozens of documents, hundreds of nodes).

- **[iframe CSP/CORS]** The workflow diagram loads Google Fonts via CDN. If served behind a restrictive CSP, the iframe may not render correctly. → Mitigation: Vite dev server has no CSP by default. For production, add the font CDN to the allowed sources.
