## ADDED Requirements

### Requirement: Document text SHALL be split into token-bounded chunks
The system SHALL split the parsed document's `fullText` into chunks of approximately 100,000 tokens each using the `cl100k_base` tokenizer (via `gpt-tokenizer`). If the document is under 100,000 tokens, a single chunk SHALL be produced.

#### Scenario: Small document produces single chunk
- **WHEN** a document with 50,000 tokens of content is parsed
- **THEN** the chunking step produces exactly 1 chunk containing the full text

#### Scenario: Large document produces multiple chunks
- **WHEN** a document with 250,000 tokens of content is parsed
- **THEN** the chunking step produces 3 chunks, each approximately 100,000 tokens (last chunk may be smaller)

#### Scenario: Chunk boundaries respect word boundaries
- **WHEN** a token boundary falls in the middle of a word
- **THEN** the split point SHALL be adjusted to the nearest whitespace boundary to avoid splitting words

### Requirement: Each chunk SHALL carry positional metadata
Each chunk SHALL include its index (0-based), the total number of chunks, and the source document ID.

#### Scenario: Chunk metadata is populated
- **WHEN** a document is split into 5 chunks
- **THEN** each chunk object contains `{ chunkIndex: number, totalChunks: 5, documentId: string, text: string }`

### Requirement: Document parsing SHALL retry on failure
The document parsing step (which precedes chunking) SHALL retry up to 2 times on I/O or parsing errors with no backoff delay. Chunking itself is a synchronous pure function (CPU-only tokenization) and does not require retries.

#### Scenario: Transient I/O error during parsing
- **WHEN** the first parsing attempt fails with an I/O error
- **THEN** the system retries immediately, up to 2 additional attempts
- **THEN** if all attempts fail, the step propagates the error
