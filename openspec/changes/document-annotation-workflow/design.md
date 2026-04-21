## Context

The document-annotation-service is a NestJS microservice that extracts entities and facts from uploaded documents using a LlamaIndex workflow orchestrated by BullMQ. Today the workflow is sequential: parse → extract entities (single LLM call, 6000-char preview) → extract facts (single LLM call) → persist. This truncates large documents and misses content.

The database has `EntityType` and `FactType` catalogs with `prompt` fields that describe what to extract. Extracted `Entity`/`Fact` records link to documents via junction tables. Document status tracks: `pending | processing | done | failed`.

Stack: NestJS 11, Prisma 7 (SQLite), BullMQ, OpenAI gpt-4o-mini, @llamaindex/workflow-core 1.3.3.

## Goals / Non-Goals

**Goals:**
- Process entire document content by chunking into ~100k-token segments
- Run per-type extraction in parallel across chunks using LlamaIndex native fan-out/fan-in
- Deduplicate entities across chunks via a single LLM consolidation pass
- Support Word (.docx) and CSV file uploads
- Handle partial failures gracefully (persist successful chunks, flag failures)
- Use OpenAI structured output (JSON schema mode) for reliable extraction

**Non-Goals:**
- Changing the REST API contract (endpoints, request/response shapes) beyond adding `partial` status
- Supporting streaming or real-time extraction progress
- Implementing vector/embedding-based entity dedup (single LLM call approach chosen)
- Changing the database engine (stays SQLite)
- Modifying the BullMQ job queue infrastructure

## Decisions

### D1: Chunk size — ~100k tokens

Use `gpt-tokenizer` (tiktoken-compatible, pure JS) to count tokens. Split `fullText` on token boundaries targeting ~100k tokens per chunk. For documents under 100k tokens, no splitting occurs (single chunk).

**Rationale:** User requirement. gpt-4o-mini has 128k context, leaving ~28k for prompt/response. This is tight but acceptable since per-type prompts are small (type name + description + rules + chunk content). If prompts grow, chunk size can be reduced without architectural changes.

**Alternative considered:** 30k-50k tokens for safety margin — rejected by stakeholder in favor of maximizing chunk size.

### D2: Fan-out/fan-in via LlamaIndex `sendEvent` + state-based accumulation

After parsing, chunk the document and emit one `extractionTaskEvent` per (chunk × type) combination via `context.sendEvent(...events)`. Each extraction handler returns an `extractionResultEvent`. A collection handler accumulates results in `state.collectedResults` and emits `extractionCollectedEvent` once all expected results arrive.

```
parse → chunk → sendEvent(N×(E+F) extractionTaskEvents) → extractionResultEvent (accumulated in state) → extractionCollectedEvent → dedup → persist
```

Where N = number of chunks, E = entity types count, F = fact types count.

**Rationale:** LlamaIndex workflow-core v1.3.3 supports fan-out via `sendEvent` but does NOT have a `collectEvents` API. The `stream.filter().take().toArray()` pattern also does not exist. State-based accumulation (pushing results into `state.collectedResults` and checking length against `state.expectedResultCount`) is the proven fan-in pattern for this version.

**Alternative considered:** `collectEvents` API (documented in some LlamaIndex examples) — does not exist in workflow-core v1.3.3. Stream-based `filter().take().toArray()` — also not available in this version.

### D3: Per-type LLM calls with structured output

Each extraction task makes one OpenAI call for one type against one chunk. Use `response_format: { type: "json_schema", json_schema: { ... } }` with strict mode to guarantee valid structured output.

The JSON schema for entity extraction: `{ entities: [{ name: string }] }`
The JSON schema for fact extraction: `{ facts: [{ value: string }] }`

Type name and chunk index are tracked in the event metadata, not in the LLM response.

**Rationale:** Per-type calls isolate failures (one bad extraction doesn't lose others), allow precise prompts per type, and enable true parallelism. Structured output eliminates JSON parsing failures.

**Alternative considered:** Batch all types in one call — cheaper but less precise, and a single failure loses all types for that chunk.

### D4: Entity deduplication — single LLM call

After fan-in, pass all extracted entities (grouped by type) to one gpt-4o-mini call. The prompt asks the LLM to merge duplicates and return the canonical list. The response uses structured output: `{ entities: [{ typeName: string, name: string, mergedFrom: string[] }] }`.

**Rationale:** The catalog starts small (3 entity types). Even with 10 chunks, the total entity count stays within context limits. The `mergedFrom` field provides an audit trail.

**Risk:** If entity count grows very large (1000+), the dedup call may exceed context. Mitigation: monitor token usage; if needed, batch per entity type in a future iteration.

### D5: Partial failure with `partial` status

Add `partial` to the document status enum. Track chunk-level results: if any chunk's extraction fails after retries, persist successful results and set status to `partial` with an error message listing failed chunks.

**Rationale:** Losing all results because one chunk failed is wasteful. Users can see what was extracted and optionally retry.

### D6: Retry strategy

| Step | Retries | Backoff | Rationale |
|------|---------|---------|-----------|
| Document parsing | 2 | None (instant) | I/O errors are rare and fast to retry |
| LLM extraction call | 3 | Exponential (2s, 4s, 8s) | Rate limits, transient API errors |
| Dedup LLM call | 3 | Exponential (2s, 4s, 8s) | Same as extraction |
| DB persistence | 2 | Fixed 500ms | SQLite WAL lock contention |
| BullMQ job (outer) | 3 | Exponential (2s base) | Already configured, catches unhandled failures |

Retries are implemented at the step level (within the workflow), not at the workflow level. The BullMQ outer retry is a last-resort catch-all.

### D7: Word and CSV parsers

- **Word (.docx):** Use `mammoth` — converts .docx to plain text. Lightweight, well-maintained, no native deps.
- **CSV:** Use `csv-parse/sync` — synchronous CSV parsing with header auto-detection. If first row values all start with a letter, treated as headers; otherwise uses `Column1`, `Column2`, etc. Rows formatted as `"col1: val1, col2: val2"` per row.

Both produce a `fullText` string consistent with existing PDF/Excel parsers. The `ParsedDocument` type gains a `'word' | 'csv'` option for the `type` field.

**Alternative considered:** `docx` package for Word — heavier, more features than needed. `mammoth` is simpler for text extraction.

### D8: Token counting with gpt-tokenizer

Use `gpt-tokenizer` package with `cl100k_base` encoding (used by gpt-4o-mini). Pure JavaScript, no WASM/native dependencies, works in any Node environment.

**Alternative considered:** `tiktoken` (official OpenAI) — requires WASM, heavier. `js-tiktoken` — similar to gpt-tokenizer but less maintained.

## Risks / Trade-offs

- **[LLM call volume]** Per-type extraction with 7 types and 10 chunks = 70 LLM calls per document. → Mitigation: Monitor cost; types and chunks are both small today. Can batch types later if cost becomes an issue.
- **[Rate limiting]** 70 parallel LLM calls may hit OpenAI rate limits. → Mitigation: LlamaIndex workflow handles events sequentially within a single Node.js process; actual parallelism is bounded by the async event loop + OpenAI's concurrency. Add a concurrency semaphore (max 10 in-flight LLM calls) if rate limits are hit.
- **[100k chunk + prompt fit]** With a 128k context window, 100k chunk leaves ~28k for prompt and response. → Mitigation: Per-type prompts are small (~200 tokens each). Monitor for truncation errors; reduce chunk size if needed.
- **[Dedup context overflow]** Very large documents may produce thousands of entities. → Mitigation: Unlikely with current catalog (3 types). Monitor and batch per-type if needed.
- **[SQLite under load]** Multiple concurrent document jobs with many persistence operations. → Mitigation: WAL mode already configured. Batch inserts within a transaction. One job at a time writes.
