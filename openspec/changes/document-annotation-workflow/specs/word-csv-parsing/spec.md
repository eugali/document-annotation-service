## ADDED Requirements

### Requirement: The system SHALL accept Word (.docx) file uploads
The document upload endpoint SHALL accept files with MIME type `application/vnd.openxmlformats-officedocument.wordprocessingml.document` and extension `.docx`.

#### Scenario: Upload a Word document
- **WHEN** a user uploads a .docx file via POST /documents
- **THEN** the file is accepted and a document record is created with status "pending"

#### Scenario: Reject unsupported Word formats
- **WHEN** a user uploads a .doc file (legacy Word format)
- **THEN** the upload is rejected with a 400 error

### Requirement: The system SHALL accept CSV file uploads
The document upload endpoint SHALL accept files with MIME type `text/csv` and extension `.csv`.

#### Scenario: Upload a CSV file
- **WHEN** a user uploads a .csv file via POST /documents
- **THEN** the file is accepted and a document record is created with status "pending"

### Requirement: Word documents SHALL be parsed to plain text
The system SHALL use the `mammoth` library to convert .docx files to plain text. The resulting `ParsedDocument` SHALL have type `'word'` and a populated `fullText` field.

#### Scenario: Parse a Word document
- **WHEN** a .docx file enters the parsing step
- **THEN** `mammoth` extracts the text content
- **THEN** a `ParsedDocument` with `type: 'word'` and `fullText` containing the document text is produced

#### Scenario: Word document with images and tables
- **WHEN** a .docx file contains embedded images and tables
- **THEN** images are ignored (text-only extraction)
- **THEN** table content is included as text rows

### Requirement: CSV files SHALL be parsed to structured text
The system SHALL parse CSV files using `csv-parse` and produce a `ParsedDocument` with type `'csv'`. Each row SHALL be formatted as `"col1: val1, col2: val2, ..."` using header names as keys. The `fullText` field SHALL contain all rows concatenated with newlines.

#### Scenario: Parse a CSV with headers
- **WHEN** a .csv file with headers ["Name", "Amount", "Date"] and 100 rows is parsed
- **THEN** `fullText` contains 100 lines, each formatted as `"Name: John, Amount: 500, Date: 2026-01-01"`

#### Scenario: CSV without headers
- **WHEN** a .csv file has no header row
- **THEN** columns are labeled as `"Column1"`, `"Column2"`, etc.

### Requirement: Parsing step SHALL retry on failure
Word and CSV parsing SHALL retry up to 2 times on I/O or parsing errors with no backoff delay, consistent with existing PDF/Excel retry behavior.

#### Scenario: Corrupt Word file
- **WHEN** mammoth fails to parse a .docx file after all retries
- **THEN** the parsing step propagates the error and the document is marked as failed
