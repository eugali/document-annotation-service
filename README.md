# Document Annotation Service

A service that extracts structured entities and facts from documents using AI. Upload files, define what to extract via a configurable catalog, and let a background pipeline chunk, analyze, and link results automatically.

## Features

- **Multi-format document ingestion** — PDF, DOCX, XLSX, XLS, CSV with page/cell reference tracking
- **Configurable extraction catalog** — define entity types and fact types with custom AI prompts
- **AI-powered extraction** — uses OpenAI (GPT) with structured JSON output for reliable entity and fact extraction
- **Smart chunking** — splits documents into token-limited chunks, deduplicates results across chunks
- **Fact-to-entity linking** — automatically links extracted facts to relevant entities using AI
- **Background job processing** — BullMQ + Redis queue with retry logic and real-time status tracking
- **React frontend** — document upload, catalog management, job monitoring, and annotation viewer

## Prerequisites

- Node.js >= 18
- Docker & Docker Compose
- An OpenAI API key

## Setup

```bash
# 1. Clone the repo and cd into the service
cd document-annotation-service

# 2. Copy the env file and fill in your OpenAI key
cp .env.example .env

# 3. Install backend dependencies
npm install

# 4. Start Redis
docker compose up -d

# 5. Run database migrations
npx prisma migrate deploy

# 6. Generate Prisma client
npx prisma generate

# 7. Start the backend (watch mode)
npm run start:dev
```

## Frontend

```bash
# In a separate terminal
cd frontend
npm install
npm run dev
```

## Access

- Backend API: http://localhost:3000
- Frontend: http://localhost:5173

## Usage

**Flow**: Catalog → Documents → Jobs → Documents (view results)

### Catalog (`/catalog`)

Define what to extract. Two sections: **Entity Types** and **Fact Types**.

- **Create**: click "+ Create", fill Name, Description, Prompt (AI extraction instruction). Click "Create".
- **Edit**: modify fields on the card, click "Save".
- **Delete**: click "Delete" and confirm (removes associated extractions).

Set up types here *before* uploading documents.

### Documents (`/documents`)

1. Select a file (`.pdf`, `.xlsx`, `.xls`, `.docx`, `.csv`) and click "Upload".
2. Status auto-refreshes every 5s: `pending` → `processing` → `done`.
3. Click "View" on completed documents to see extracted entities and facts.

### Jobs (`/jobs`)

Monitors background processing jobs. Auto-refreshes while jobs are active. Use refresh buttons for manual reload.

## Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```
