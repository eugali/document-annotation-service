# Document Annotation LlamaIndex Workflow Visualization

Source of truth:
- `src/processing/pipeline/extraction.workflow.ts`
- `src/processing/pipeline/create-extraction-workflow.ts`
- `src/processing/pipeline/workflow-events.ts`

## High-level workflow

```mermaid
flowchart TD
    A[ExtractionWorkflow.run(documentId)] --> B[Load document from Prisma]
    B --> C[Load entity types + fact types from CatalogService]
    C --> D[createExtractionWorkflow()]
    D --> E[workflow.createContext(state)]
    E --> F[startExtractionEvent]

    F --> G[Step 1: parseDocument\nreturns documentParsedEvent]
    G --> H[Step 2: chunkDocument(fullText)]
    H --> I[Compute expectedResultCount\nchunks × (entityTypes + factTypes)]
    I --> J[Fan-out extractionTaskEvent for every\nchunk × entity type × fact type]

    J --> K[Step 3a: extractEntityType]
    J --> L[Step 3b: extractFactType]

    K --> M[extractionResultEvent]
    L --> M
    M --> N[Step 4: collect in state.collectedResults]
    N --> O{All results collected?}
    O -- No --> N
    O -- Yes --> P[Build entities + facts + failures\nreturn extractionCollectedEvent]

    P --> Q[Step 5: deduplicateEntities]
    Q --> R[dedupCompleteEvent]
    R --> S[Step 6: persistResults]
    S --> T{Any failures?}
    T -- Yes --> U[Update document status = partial\nstore error summary]
    T -- No --> V[Skip partial update]
    U --> W[extractionCompleteEvent]
    V --> W

    W --> X[ctx.stream.untilEvent(extractionCompleteEvent)]
    X --> Y[Workflow completes]
```

## Event-level view

```mermaid
flowchart LR
    SE[startExtractionEvent]
    DP[documentParsedEvent]
    ET[extractionTaskEvent]
    ER[extractionResultEvent]
    EC[extractionCollectedEvent]
    DC[dedupCompleteEvent]
    DONE[extractionCompleteEvent]

    SE --> DP
    DP --> ET
    ET --> ER
    ER --> EC
    EC --> DC
    DC --> DONE
```

## Fan-out / fan-in detail

```mermaid
flowchart TD
    A[documentParsedEvent] --> B[chunkDocument]
    B --> C1[Chunk 1]
    B --> C2[Chunk 2]
    B --> C3[Chunk N]

    C1 --> D11[Entity type A task]
    C1 --> D12[Entity type B task]
    C1 --> D13[Fact type X task]

    C2 --> D21[Entity type A task]
    C2 --> D22[Entity type B task]
    C2 --> D23[Fact type X task]

    C3 --> D31[...]

    D11 --> E[extractionResultEvent]
    D12 --> E
    D13 --> E
    D21 --> E
    D22 --> E
    D23 --> E
    D31 --> E

    E --> F[Append to state.collectedResults]
    F --> G{collectedResults.length\n== expectedResultCount?}
    G -- No --> F
    G -- Yes --> H[Aggregate all successful entities/facts\nand collect failures]
    H --> I[extractionCollectedEvent]
```

## Notes

- The workflow uses `withState(createWorkflow())` and stores fan-in state in:
  - `expectedResultCount`
  - `collectedResults`
- Failures in per-type extraction do **not** stop the workflow; they are converted into `extractionResultEvent` objects with an `error` field.
- Persistence always runs with whatever successful results were collected.
- If any extraction task failed, the document is marked `partial` after persistence.
- `chunkReadyEvent` exists in `workflow-events.ts` but is not currently used by `create-extraction-workflow.ts`.
