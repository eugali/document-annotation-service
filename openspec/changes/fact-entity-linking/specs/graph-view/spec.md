## ADDED Requirements

### Requirement: The "All Extractions" tab SHALL be replaced with a graph view

The `ExtractionsTab` SHALL be replaced with an interactive graph/canvas visualization. The tab label SHALL change from "All Extractions" to "Graph". The graph SHALL display documents, entities, and facts as distinct node types with edges representing their relationships.

#### Scenario: Graph displays all node types

- **WHEN** the user navigates to the Graph tab
- **THEN** the graph renders document nodes, entity nodes, and fact nodes with visually distinct styling (color, shape, or icon per type)

#### Scenario: Empty state

- **WHEN** no extractions exist in the system
- **THEN** the graph tab displays a message indicating no data is available

### Requirement: Graph edges SHALL represent all relationships

The graph SHALL draw edges for: document→entity (DocumentEntity), document→fact (DocumentFact), and fact↔entity (FactEntity) relationships.

#### Scenario: Document connected to its entities and facts

- **WHEN** document "contract.pdf" has 3 entities and 5 facts
- **THEN** 8 edges are drawn from the document node to its entity and fact nodes

#### Scenario: Fact linked to entities

- **WHEN** fact "salary: $150,000" is linked to entity "John Doe" and entity "Acme Corp"
- **THEN** 2 edges are drawn from the fact node to the entity nodes (visually distinct from document edges)

#### Scenario: Entity shared across documents

- **WHEN** entity "Acme Corp" appears in both "contract.pdf" and "invoice.pdf"
- **THEN** the single "Acme Corp" entity node has edges to both document nodes

### Requirement: Graph SHALL support basic interaction

The graph SHALL support panning, zooming, and node hovering. Hovering over a node SHALL display a tooltip with the node's details.

#### Scenario: Hover entity node

- **WHEN** the user hovers over entity node "John Doe"
- **THEN** a tooltip shows the entity type, name, and list of documents it appears in

#### Scenario: Hover fact node

- **WHEN** the user hovers over fact node "salary: $150,000"
- **THEN** a tooltip shows the fact type, value, source snippet, and linked entities

#### Scenario: Hover document node

- **WHEN** the user hovers over document node "contract.pdf"
- **THEN** a tooltip shows the filename, status, and counts of entities and facts

### Requirement: Graph data SHALL be fetched from an updated API

The extractions API endpoint SHALL be updated to include fact-entity links and source provenance in its response, providing all data needed to render the graph in a single request.

#### Scenario: API returns graph-ready data

- **WHEN** the frontend fetches `/api/extractions`
- **THEN** the response includes entities (with source snippets and document IDs), facts (with source snippets, document IDs, and linked entity IDs), and documents
