## ADDED Requirements

### Requirement: The Vite app SHALL include a README tab

A new tab labeled "README" SHALL be added as the first tab in the frontend tab bar (before Documents). This tab SHALL embed the content of `workflow-diagram.html` which describes the extraction pipeline architecture.

#### Scenario: User navigates to README tab

- **WHEN** the user clicks the "README" tab (first tab in the bar)
- **THEN** the workflow diagram is displayed within the app layout, fully interactive (scrollable, styled)

### Requirement: The workflow diagram SHALL be embedded via iframe

The `ReadmeTab` component SHALL render an iframe that loads the `workflow-diagram.html` file served as a static asset by Vite. The iframe SHALL fill the available content area.

#### Scenario: Diagram renders correctly

- **WHEN** the README tab is active
- **THEN** the iframe loads the workflow diagram with its full styling (dark theme, interactive scroll cards, graph)
- **THEN** the iframe has no visible border and fills the tab content area

#### Scenario: Diagram fonts load

- **WHEN** the workflow diagram loads in the iframe
- **THEN** the Google Fonts (Inter) load correctly and the diagram renders with the intended typography
