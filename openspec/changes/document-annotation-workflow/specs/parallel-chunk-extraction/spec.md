## ADDED Requirements

### Requirement: Extraction SHALL fan out into parallel per-chunk steps
After chunking, the workflow SHALL emit one event per chunk. Each chunk event SHALL trigger parallel extraction handlers — one per entity type and one per fact type — using LlamaIndex's native event-driven parallelism.

#### Scenario: Fan-out with 3 chunks and 7 types
- **WHEN** a document is split into 3 chunks and the catalog has 3 entity types and 4 fact types
- **THEN** the workflow emits 3 chunk events, each spawning 7 extraction tasks (21 total LLM calls)
- **THEN** all 21 tasks run concurrently (bounded by async event loop)

#### Scenario: Single chunk document
- **WHEN** a document produces 1 chunk with 3 entity types and 4 fact types
- **THEN** 7 extraction tasks are spawned for that single chunk

### Requirement: Each extraction task SHALL make one LLM call per type per chunk
Each extraction task SHALL call OpenAI gpt-4o-mini with the chunk text and a single type definition (entity type or fact type). The prompt SHALL include the type's `name` and `prompt` field from the catalog.

#### Scenario: Entity type extraction for a chunk
- **WHEN** an extraction task runs for entity type "person" on chunk 2
- **THEN** the LLM receives the chunk text and the "person" type definition
- **THEN** the LLM returns entities matching only that type

#### Scenario: Fact type extraction for a chunk
- **WHEN** an extraction task runs for fact type "monetary_amount" on chunk 0
- **THEN** the LLM receives the chunk text and the "monetary_amount" type definition
- **THEN** the LLM returns facts matching only that type

### Requirement: LLM calls SHALL use OpenAI structured output (JSON schema mode)
All extraction LLM calls SHALL use `response_format: { type: "json_schema" }` with strict mode enabled. Entity extraction SHALL return `{ entities: [{ name: string }] }`. Fact extraction SHALL return `{ facts: [{ value: string }] }`.

#### Scenario: Structured output for entity extraction
- **WHEN** an entity extraction LLM call completes
- **THEN** the response is guaranteed valid JSON matching `{ entities: [{ name: string }] }`

#### Scenario: Structured output for fact extraction
- **WHEN** a fact extraction LLM call completes
- **THEN** the response is guaranteed valid JSON matching `{ facts: [{ value: string }] }`

### Requirement: Extraction results SHALL be collected before proceeding
The workflow SHALL use state-based accumulation (collecting `extractionResultEvent` data in `state.collectedResults` and checking against `state.expectedResultCount`) to wait for all extraction tasks to complete before proceeding to the deduplication step.

#### Scenario: All tasks complete successfully
- **WHEN** all 21 extraction tasks complete
- **THEN** results are aggregated into a combined list of entities and a combined list of facts
- **THEN** the deduplication step begins

#### Scenario: Some tasks fail after retries
- **WHEN** 19 of 21 extraction tasks complete and 2 fail after all retries
- **THEN** the 19 successful results are still collected
- **THEN** the failed chunks/types are recorded for partial failure handling

### Requirement: LLM extraction calls SHALL retry with exponential backoff
Each LLM extraction call SHALL retry up to 3 times with exponential backoff (2s, 4s, 8s delays).

#### Scenario: Rate limit triggers retry
- **WHEN** an LLM call returns a 429 rate limit error
- **THEN** the system waits 2s and retries
- **THEN** if the retry fails again, waits 4s and retries once more

#### Scenario: All retries exhausted
- **WHEN** an LLM call fails 4 times (initial + 3 retries)
- **THEN** the extraction task is marked as failed
- **THEN** the failure is reported to the fan-in collector
