## Why

The extraction pipeline produces entities and facts as independent, flat records with no provenance and no relationships between them. A fact like "salary: $150,000/year" exists in the database with no trace of which entity it describes or where in the source document it was found. This limits the value of extractions — downstream consumers cannot answer "what do we know about John Doe?" without manual cross-referencing. Adding source provenance and fact-entity linking turns flat extractions into a connected knowledge graph.

## What Changes

- Facts gain a many-to-many relationship with entities via a new `FactEntity` junction table, populated by a new LLM-based linking step in the extraction pipeline
- Both entities and facts gain source provenance (snippet, page, cell) as first-class fields in the data model
- Entity deduplication becomes cross-document: entities are shared across documents by matching on `(entityTypeId, name)` instead of always creating new records
- The `FactType` catalog gains an optional `entityLinkHint` text field so humans can guide the linking LLM
- Entity types and fact types can be created and deleted from the catalog, with cascading deletion of all associated extractions
- The "All Extractions" tab is replaced with an interactive graph/canvas view showing documents, entities, facts, and their connections
- The existing `workflow-diagram.html` is embedded into the Vite app as a new "README" tab (first tab in the bar)

## Capabilities

### New Capabilities
- `source-provenance`: Source snippet, page, and cell tracking for both entities and facts throughout the extraction pipeline
- `fact-entity-linking`: LLM-based many-to-many linking between facts and entities as a post-dedup pipeline step
- `cross-document-entities`: Entity sharing across documents via upsert-on-match during persist
- `catalog-crud`: Create and delete entity types and fact types with cascading deletion of associated extractions
- `graph-view`: Interactive graph/canvas visualization of documents, entities, facts, and their connections
- `rationale-tab`: Embedding the workflow diagram HTML into the Vite app as the first tab ("README")

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **Database schema**: New tables (`EntitySource`, `FactEntity`), new columns on `Fact` (source fields) and `FactType` (`entityLinkHint`), added `onDelete: Cascade` on `Entity.entityType` and `Fact.factType` relations
- **Extraction pipeline**: New workflow step between dedup and persist; extraction prompts updated to return source snippets; dedup step preserves sources via `mergedFrom` mapping; persist step does upsert instead of always-create for entities
- **REST API**: New endpoints for creating/deleting entity types and fact types; extractions endpoint updated to include source provenance and fact-entity links
- **Frontend**: `ExtractionsTab` replaced with graph view (new dependency on a graph visualization library); new `RationaleTab` component; `CatalogTab` gains create/delete UI
- **LLM cost**: One additional LLM call per document for the linking step (post-dedup)
