## ADDED Requirements

### Requirement: Facts SHALL be linked to entities via a many-to-many relationship

The system SHALL maintain a `FactEntity` junction table that links facts to entities. A fact MAY link to zero, one, or many entities. An entity MAY be linked to zero, one, or many facts.

#### Scenario: Fact linked to one entity

- **WHEN** fact "salary: $150,000/year" is determined to relate to entity "John Doe" (person)
- **THEN** one `FactEntity` record is created linking the fact to the entity

#### Scenario: Fact linked to multiple entities

- **WHEN** fact "salary: $150,000/year" relates to both "John Doe" (person) and "Acme Corp" (organization)
- **THEN** two `FactEntity` records are created, one for each entity

#### Scenario: Fact with no entity links

- **WHEN** fact "GDP: $21.4 trillion" (monetary_amount) does not relate to any extracted entity
- **THEN** no `FactEntity` records are created for this fact

### Requirement: A post-dedup LLM step SHALL determine fact-entity links

After entity deduplication and before persistence, the pipeline SHALL execute a linking step that makes an LLM call with all facts (including their `sourceSnippet`) and all canonical deduplicated entities, returning which entities each fact relates to.

#### Scenario: Linking uses source snippets for disambiguation

- **WHEN** two persons "John Doe" and "Jane Smith" exist, and fact "salary: $150,000/year" has sourceSnippet "John Doe's annual salary is $150,000/year"
- **THEN** the linking LLM links the fact to "John Doe" only, not "Jane Smith"

#### Scenario: Linking uses catalog hints when available

- **WHEN** fact type "monetary_amount" has entityLinkHint "often related to person or organization"
- **THEN** the linking LLM prompt includes this hint as context alongside the source snippets

#### Scenario: Linking without catalog hints

- **WHEN** a fact type has no entityLinkHint
- **THEN** the linking LLM still attempts to determine entity links using source snippets alone

### Requirement: Linking LLM call SHALL use structured output

The linking step SHALL use OpenAI structured output (`response_format: { type: "json_schema" }`) returning `{ links: [{ factIndex: number, entityNames: string[], entityTypes: string[] }] }`.

#### Scenario: Structured linking response

- **WHEN** the linking LLM processes 10 facts against 5 entities
- **THEN** the response is guaranteed valid JSON matching the schema
- **THEN** each link entry references a fact by index and entities by canonical name and type

### Requirement: Linking LLM call SHALL retry with exponential backoff

The linking call SHALL retry up to 3 times with exponential backoff (2s, 4s, 8s). If all retries fail, facts SHALL be persisted without entity links.

#### Scenario: Linking call fails after retries

- **WHEN** the linking LLM call fails on all 3 retry attempts
- **THEN** all facts and entities are persisted normally without any `FactEntity` records
- **THEN** the document status is NOT set to failed or partial due to linking failure alone

### Requirement: FactType SHALL support an optional entityLinkHint

The `FactType` model SHALL include an optional `entityLinkHint` text field. This field provides human-authored guidance to the linking LLM about which entity types a fact type typically relates to.

#### Scenario: FactType with hint

- **WHEN** a fact type is created with entityLinkHint "usually describes a person's compensation"
- **THEN** the hint is stored on the `FactType` record and included in the linking LLM prompt

#### Scenario: FactType without hint

- **WHEN** a fact type is created without an entityLinkHint
- **THEN** the `entityLinkHint` field is null and omitted from the linking prompt
