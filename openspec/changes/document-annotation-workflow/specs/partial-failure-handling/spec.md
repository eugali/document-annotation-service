## ADDED Requirements

### Requirement: Document status SHALL support a "partial" value
The document status field SHALL accept a new value `partial` in addition to `pending`, `processing`, `done`, and `failed`. A document is `partial` when some but not all extraction tasks completed successfully.

#### Scenario: Some chunks fail, some succeed
- **WHEN** a document has 5 chunks and chunks 0-3 complete but chunk 4 fails after all retries
- **THEN** the document status is set to `partial`
- **THEN** results from chunks 0-3 are persisted
- **THEN** the document's `error` field records which chunks/types failed

#### Scenario: All chunks succeed
- **WHEN** all extraction tasks for all chunks complete successfully
- **THEN** the document status is set to `done` (not `partial`)

#### Scenario: All chunks fail
- **WHEN** every extraction task fails after retries
- **THEN** the document status is set to `failed`

### Requirement: Successful extraction results SHALL be persisted even on partial failure
When some extraction tasks fail, the system SHALL still persist all successfully extracted entities and facts. The persist step SHALL NOT discard results from successful chunks.

#### Scenario: Partial results are queryable
- **WHEN** a document is in `partial` status
- **THEN** GET /documents/:id/annotations returns `{ status: "partial", entities: {...}, facts: {...}, error: "..." }`
- **THEN** the entities and facts reflect only the successful extractions

### Requirement: Error details SHALL identify failed chunks and types
The document's `error` field SHALL contain a structured description of which chunk indices and which types failed, enabling targeted retry or investigation.

#### Scenario: Error message format
- **WHEN** chunk 4 fails for entity type "person" and fact type "date_reference"
- **THEN** the error field contains a message like: `"Extraction failed for chunk 4: person (entity), date_reference (fact)"`

### Requirement: Annotations endpoint SHALL return partial status
The GET /documents/:id/annotations endpoint SHALL return HTTP 200 with `status: "partial"` when the document has partial results, including both the extracted annotations and the error details.

#### Scenario: Partial status response
- **WHEN** a client requests annotations for a document with status `partial`
- **THEN** the response is HTTP 200 with `{ status: "partial", entities: {...}, facts: {...}, error: "..." }`
