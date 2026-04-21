## ADDED Requirements

### Requirement: Entity extraction SHALL return source provenance

The extraction LLM call for entities SHALL return a `sourceSnippet` (the verbatim text passage where the entity was found) along with a `sourcePage` (for PDFs) or `sourceCell` (for spreadsheets) for each extracted entity.

#### Scenario: Entity extracted from PDF

- **WHEN** the entity extraction step extracts entity "John Doe" (person) from a PDF chunk
- **THEN** the `ExtractedEntity` includes `sourceSnippet` containing the verbatim passage and `sourcePage` indicating the page number

#### Scenario: Entity extracted from spreadsheet

- **WHEN** the entity extraction step extracts entity "Acme Corp" (organization) from a spreadsheet chunk
- **THEN** the `ExtractedEntity` includes `sourceSnippet` containing the cell context and `sourceCell` indicating the cell reference

#### Scenario: Entity extracted from Word or CSV

- **WHEN** the entity extraction step extracts an entity from a Word or CSV document
- **THEN** the `ExtractedEntity` includes `sourceSnippet` with no `sourcePage` or `sourceCell` (these fields are null)

### Requirement: Fact extraction SHALL return source provenance

The extraction LLM call for facts SHALL return a `sourceSnippet`, `sourcePage`, and `sourceCell` for each extracted fact, following the same rules as entity provenance.

#### Scenario: Fact extracted from PDF

- **WHEN** the fact extraction step extracts fact "salary: $150,000/year" from a PDF chunk
- **THEN** the `ExtractedFact` includes `sourceSnippet` with the verbatim passage and `sourcePage` with the page number

#### Scenario: Fact extracted from spreadsheet

- **WHEN** the fact extraction step extracts a monetary amount from a spreadsheet chunk
- **THEN** the `ExtractedFact` includes `sourceSnippet` and `sourceCell` with the cell reference

### Requirement: Entity sources SHALL be stored in a dedicated EntitySource table

Each extracted entity's source provenance SHALL be persisted in an `EntitySource` table with a many-to-one relationship to `Entity`. This accommodates entities that are deduplicated from multiple source locations.

#### Scenario: Entity with single source

- **WHEN** entity "John Doe" is extracted from one chunk only
- **THEN** one `EntitySource` record is created with snippet, page/cell, and chunkIndex

#### Scenario: Entity merged from multiple sources via dedup

- **WHEN** entity "John Doe" is the canonical result of merging "John Doe" (chunk 0, page 2) and "J. Doe" (chunk 3, page 17)
- **THEN** two `EntitySource` records are created, one for each original extraction location

### Requirement: Fact source provenance SHALL be stored as columns on the Fact model

Each fact's source provenance SHALL be stored as `sourceSnippet` (required), `sourcePage` (nullable), and `sourceCell` (nullable) columns directly on the `Fact` table.

#### Scenario: Fact persisted with source

- **WHEN** a fact is persisted to the database
- **THEN** the `Fact` record includes `sourceSnippet` with the text passage where it was found

### Requirement: Dedup step SHALL preserve source provenance

The entity deduplication step SHALL carry all source provenance from merged entities into the deduplicated result. The `DedupedEntity` type SHALL include a `sources` array containing snippet, page/cell, and chunkIndex for every original extraction that was merged.

#### Scenario: Dedup preserves sources via mergedFrom mapping

- **WHEN** the dedup LLM merges "John Doe" and "J. Doe" into canonical "John Doe"
- **THEN** the `DedupedEntity` for "John Doe" includes sources from both original `ExtractedEntity` records, matched via the `mergedFrom` field
