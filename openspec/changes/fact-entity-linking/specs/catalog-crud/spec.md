## ADDED Requirements

### Requirement: Entity types SHALL be creatable via API

The system SHALL expose `POST /api/catalog/entity-types` accepting `{ name: string, description: string, prompt: string }`. The endpoint SHALL return the created entity type with its generated ID.

#### Scenario: Create a new entity type

- **WHEN** a POST request is sent with `{ name: "vehicle", description: "A vehicle mentioned in the document", prompt: "Extract all vehicles..." }`
- **THEN** a new `EntityType` record is created and returned with status 201

#### Scenario: Duplicate entity type name

- **WHEN** a POST request is sent with a name that already exists (e.g., "person")
- **THEN** the request fails with status 409 and an error message indicating the name is taken

### Requirement: Entity types SHALL be deletable via API with cascading removal

The system SHALL expose `DELETE /api/catalog/entity-types/:id`. Deleting an entity type SHALL cascade-delete all associated `Entity` records, which in turn cascades to `DocumentEntity`, `EntitySource`, and `FactEntity` records.

#### Scenario: Delete entity type with existing extractions

- **WHEN** a DELETE request is sent for entity type "person" which has 5 associated entities
- **THEN** the `EntityType` record is deleted
- **THEN** all 5 `Entity` records of that type are deleted
- **THEN** all `DocumentEntity`, `EntitySource`, and `FactEntity` records referencing those entities are deleted

#### Scenario: Delete entity type with no extractions

- **WHEN** a DELETE request is sent for an entity type that has no associated entities
- **THEN** only the `EntityType` record is deleted

#### Scenario: Delete non-existent entity type

- **WHEN** a DELETE request is sent with an ID that does not exist
- **THEN** the request fails with status 404

### Requirement: Fact types SHALL be creatable via API

The system SHALL expose `POST /api/catalog/fact-types` accepting `{ name: string, description: string, prompt: string, entityLinkHint?: string }`. The endpoint SHALL return the created fact type with its generated ID.

#### Scenario: Create a fact type with entity link hint

- **WHEN** a POST request is sent with `{ name: "salary", description: "A salary amount", prompt: "Extract all salary figures...", entityLinkHint: "often related to person or organization" }`
- **THEN** a new `FactType` record is created with the entityLinkHint stored

#### Scenario: Create a fact type without entity link hint

- **WHEN** a POST request is sent with `{ name: "gdp", description: "GDP figure", prompt: "Extract GDP values..." }` and no entityLinkHint
- **THEN** a new `FactType` record is created with entityLinkHint as null

### Requirement: Fact types SHALL be deletable via API with cascading removal

The system SHALL expose `DELETE /api/catalog/fact-types/:id`. Deleting a fact type SHALL cascade-delete all associated `Fact` records, which in turn cascades to `DocumentFact` and `FactEntity` records.

#### Scenario: Delete fact type with existing extractions

- **WHEN** a DELETE request is sent for fact type "monetary_amount" which has 20 associated facts
- **THEN** the `FactType` record is deleted
- **THEN** all 20 `Fact` records of that type are deleted
- **THEN** all `DocumentFact` and `FactEntity` records referencing those facts are deleted

#### Scenario: Delete fact type with no extractions

- **WHEN** a DELETE request is sent for a fact type that has no associated facts
- **THEN** only the `FactType` record is deleted

### Requirement: Catalog deletion UI SHALL require confirmation

The frontend catalog tab SHALL show a delete button for each entity type and fact type. Clicking delete SHALL show a confirmation dialog warning that all associated extractions will be permanently removed.

#### Scenario: User confirms deletion

- **WHEN** the user clicks delete on entity type "person" and confirms the dialog
- **THEN** the DELETE API call is made and the type is removed from the UI

#### Scenario: User cancels deletion

- **WHEN** the user clicks delete on a type and cancels the confirmation dialog
- **THEN** no API call is made and the type remains

### Requirement: Catalog creation UI SHALL provide a form

The frontend catalog tab SHALL show a "Create" button for both entity types and fact types. The form SHALL collect name, description, and prompt fields (all required). For fact types, the form SHALL also include an optional entityLinkHint field.

#### Scenario: Create entity type from UI

- **WHEN** the user fills in name, description, and prompt and submits the entity type form
- **THEN** the POST API call is made and the new type appears in the catalog list

#### Scenario: Create fact type with hint from UI

- **WHEN** the user fills in name, description, prompt, and entityLinkHint and submits the fact type form
- **THEN** the POST API call is made and the new type appears in the catalog list with the hint stored
