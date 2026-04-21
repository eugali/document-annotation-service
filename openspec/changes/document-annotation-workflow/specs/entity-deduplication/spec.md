## ADDED Requirements

### Requirement: Extracted entities SHALL be deduplicated via a single LLM call
After all chunk extractions complete, the system SHALL pass all extracted entities to a single gpt-4o-mini LLM call that identifies and merges duplicate or equivalent entities. The output SHALL be the canonical list of unique entities.

#### Scenario: Duplicate entities across chunks
- **WHEN** chunk 0 extracts entity (person, "John Doe") and chunk 2 extracts (person, "J. Doe")
- **THEN** the dedup LLM identifies these as the same entity
- **THEN** the output contains a single entity (person, "John Doe") with a note that "J. Doe" was merged

#### Scenario: No duplicates found
- **WHEN** all extracted entities are unique
- **THEN** the dedup LLM returns the same list unchanged

#### Scenario: Entities of different types are not merged
- **WHEN** entity (person, "Washington") and entity (location, "Washington") are extracted
- **THEN** the dedup LLM keeps both as separate entities (different types)

### Requirement: Dedup LLM call SHALL use structured output
The dedup call SHALL use `response_format: { type: "json_schema" }` returning `{ entities: [{ typeName: string, name: string, mergedFrom: string[] }] }`. The `mergedFrom` array lists original names that were consolidated into the canonical name.

#### Scenario: Structured dedup output
- **WHEN** the dedup LLM processes 15 extracted entities
- **THEN** the response is guaranteed valid JSON matching the schema
- **THEN** each entity includes `mergedFrom` listing all original names (including the canonical name itself)

### Requirement: Facts SHALL NOT be deduplicated
Facts SHALL be persisted as-is without a deduplication step. Duplicate fact values across chunks are acceptable.

#### Scenario: Duplicate facts across chunks
- **WHEN** chunk 0 and chunk 3 both extract fact (monetary_amount, "$1,000")
- **THEN** both fact instances are persisted as separate records

### Requirement: Dedup LLM call SHALL retry with exponential backoff
The dedup call SHALL retry up to 3 times with exponential backoff (2s, 4s, 8s).

#### Scenario: Dedup call fails transiently
- **WHEN** the dedup LLM call fails on the first attempt
- **THEN** the system retries with 2s, 4s, 8s delays
- **THEN** if all retries fail, the raw (un-deduplicated) entities are used as fallback
