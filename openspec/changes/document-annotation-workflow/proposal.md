## Why

The current extraction pipeline sends a truncated 6000-character preview to a single LLM call per extraction type, losing most document content. Documents of real-world size (contracts, reports, spreadsheets) need full-text extraction with chunking, parallel per-type LLM calls, and entity deduplication to produce accurate, complete annotations. Additionally, Word (.docx) and CSV files are not supported today.

## What Changes

- **Document chunking**: Split parsed documents into chunks of ~100k tokens each before extraction.
- **Parallel per-chunk extraction**: For each chunk, fan out into parallel LlamaIndex workflow steps — one LLM call per entity type and one per fact type, per chunk.
- **Structured output**: Use OpenAI JSON schema mode for reliable structured extraction matching type definitions.
- **Entity deduplication**: After all chunks complete, run a single LLM call to deduplicate and merge equivalent entities.
- **Partial failure handling**: Add a `partial` document status so successful chunks are persisted even if some fail.
- **Word & CSV support**: Add parsers for `.docx` and `.csv` files alongside existing PDF and Excel support.
- **Retry strategy**: Per-step retries with exponential backoff (3 retries for LLM calls, 2 for parsing/persistence).

## Capabilities

### New Capabilities
- `document-chunking`: Split parsed document text into ~100k-token chunks with metadata tracking.
- `parallel-chunk-extraction`: Fan-out/fan-in LlamaIndex workflow steps — per-type LLM calls running in parallel across all chunks.
- `entity-deduplication`: Post-extraction LLM pass to merge duplicate/equivalent entities across chunks.
- `word-csv-parsing`: Parse .docx (Word) and .csv files into extractable text.
- `partial-failure-handling`: Track per-chunk success/failure, persist partial results, add `partial` document status.

### Modified Capabilities
_(none — no existing specs)_

## Impact

- **Database schema**: Add `partial` to document status enum. Potentially add chunk tracking fields.
- **Processing pipeline**: Complete rewrite of `extraction.workflow.ts` and its step files to support chunking + fan-out/fan-in.
- **Dependencies**: Add `mammoth` (Word parsing), `csv-parse` (CSV parsing), `tiktoken` or `gpt-tokenizer` (token counting).
- **File validation**: Update `SUPPORTED_MIME_TYPES` and `SUPPORTED_EXTENSIONS` to include `.docx`, `.csv`.
- **API contracts**: The `/documents/:id/annotations` response structure remains the same; the `status` field gains a new `partial` value.
- **Cost**: Per-type extraction multiplies LLM calls significantly (types × chunks). Budget-sensitive deployments should monitor usage.
