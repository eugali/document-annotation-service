## ADDED Requirements

### Requirement: Entities SHALL be shared across documents by exact match

During the persist step, before creating a new `Entity` record, the system SHALL check if an entity with the same `entityTypeId` and `name` already exists. If a match is found, the system SHALL create only the `DocumentEntity` link to the existing entity instead of creating a duplicate.

#### Scenario: New entity with no prior match

- **WHEN** the persist step processes entity "John Doe" (person) and no entity with `(person, "John Doe")` exists in the database
- **THEN** a new `Entity` record is created and a `DocumentEntity` link is created for the current document

#### Scenario: Entity already exists from a previous document

- **WHEN** the persist step processes entity "Acme Corp" (organization) and an entity with `(organization, "Acme Corp")` already exists from a previously processed document
- **THEN** no new `Entity` record is created
- **THEN** a new `DocumentEntity` link is created connecting the existing entity to the current document

#### Scenario: Same entity name, different types are not shared

- **WHEN** entity "Washington" (person) exists and the persist step processes "Washington" (location)
- **THEN** a new `Entity` record is created for the location type (different entityTypeId)

#### Scenario: Entity sources are appended to shared entity

- **WHEN** entity "Acme Corp" already exists with sources from document A, and document B also extracts "Acme Corp" with new sources
- **THEN** the new `EntitySource` records from document B are added to the existing entity (sources accumulate across documents)

### Requirement: Entity uniqueness SHALL be enforced at the database level

The `Entity` table SHALL have a unique constraint on `(entityTypeId, name)` to prevent duplicate entities from concurrent document processing.

#### Scenario: Concurrent document processing with same entity

- **WHEN** two documents are processed simultaneously and both extract entity "Acme Corp" (organization)
- **THEN** only one `Entity` record exists after both complete
- **THEN** both documents have `DocumentEntity` links to the same entity
