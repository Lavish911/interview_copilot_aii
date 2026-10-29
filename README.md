# 🎙️ Interview Copilot AI (with Production RAG Pipeline)

> **A real-time AI interview preparation and assistance platform built with React, Node.js, Socket.IO, Multi-Document Semantic RAG (`gemini-embedding-001` / `text-embedding-3-small`), Google Gemini Cascade, and OpenAI.**

[![Live Frontend](https://img.shields.io/badge/Frontend-Vercel-black?style=flat&logo=vercel)](https://interview-copilot-aii.vercel.app/)
[![Live Backend](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat&logo=render)](https://interview-copilot-aii.onrender.com/health)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=flat&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue?style=flat&logo=react)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Interview Copilot AI combines live interview assistance, **Retrieval-Augmented Generation (RAG)** over user-uploaded documents, mock interviews, ATS resume analysis, coding practice, and speech analytics into a unified real-time workspace. The platform is engineered around low-latency bidirectional Socket.IO streaming, real dense vector embeddings, per-session multi-tenant vector isolation, prompt-injection defense, and a resilient multi-provider failover cascade.

---

## ✨ Features

- **Production RAG Knowledge Base** — Upload resumes/CVs, job descriptions, interview prep notes, and technical docs (`PDF`, `DOCX`, `TXT`, `MD`, or OCR images). Documents are parsed with page/section metadata, split into overlapping deduplicated chunks, embedded with `gemini-embedding-001` (3072-dim) or `text-embedding-3-small`, and queried via exact cosine similarity.
- **Grounded Answers & Verbatim Citations** — Every live answer displays a real-time grounding status badge (`Grounded in N passages`, `General AI · No matching passage in uploaded docs`, or `Offline Engine · Not document-grounded`) and expandable source citations showing `[Source N]`, filename, page number, section title, cosine similarity score, and verbatim supporting excerpt.
- **Prompt Injection Defense** — Retrieved passages are sanitized and enclosed inside `<untrusted_document_context>` delimiters so adversarial instructions inside uploaded documents cannot override system prompts or expose secrets.
- **Live AI Copilot (Voice + Typed Input)** — Capture spoken interview questions via Web Speech API or type questions directly, and receive incrementally streamed answers over Socket.IO.
- **Multi-Tier AI Cascade** — Intelligent 3-tier failover (`OpenAI GPT-4o-mini` → `Gemini 2.5 Flash / Flash-Lite Dynamic Key Pool` → `Offline FastEngine Knowledge Base`) with TTL circuit breakers. Retrieved RAG context is preserved across OpenAI → Gemini failover, and offline fallback responses are never falsely labeled as document-grounded.
- **Stealth / Floating Mode** — Compact floating heads-up display via the browser Document Picture-in-Picture API (`Ctrl+Shift+H`).
- **Screen & Vision Analysis** — Multimodal screen frame capture and document OCR powered by Gemini Vision.
- **Mock Interview Simulator & ATS Resume Studio** — Role-targeted technical/behavioral simulations with STAR scoring, ATS compatibility scoring (0–100), and job-targeted cover letter generation.
- **Coding Practice Workspace & Speech Analytics** — In-browser sandboxed JS execution and real-time WPM/filler-word telemetry.

---

## 🏗️ System & RAG Architecture

```mermaid
graph TD
    Client["React 18 Client (Vite + Tailwind)"] -->|Socket.IO (question, rag:*)| Server["Node.js / Express 5 Server"]
    Client -->|HTTP POST /api/rag/documents & /api/upload-resume| Server

    subgraph "RAG Ingestion & Vector Pipeline (server/rag_engine.js)"
        Parser["Document Parser (PDF per-page, DOCX, TXT/MD, Gemini OCR)"] --> Normalizer["Text Normalizer & Section Detector"]
        Normalizer --> Chunker["Overlapping Sliding-Window Chunker + SHA-256 Deduplicator"]
        Chunker --> Embedder["Embedding Engine (gemini-embedding-001 / text-embedding-3-small)"]
        Embedder --> VectorStore["Multi-Tenant Session-Isolated Vector Index (Cosine Similarity)"]
    end

    subgraph "Retrieval-Augmented Generation & AI Failover (server/ai_engine.js)"
        Server --> VectorStore
        VectorStore -->|Top-K Chunks + Citations| PromptBuilder["Grounded Prompt Builder (<untrusted_document_context>)"]
        PromptBuilder --> AICascade["Unified AIEngine Orchestrator"]
        AICascade -->|Tier 1| OpenAI["OpenAI (gpt-4o-mini)"]
        AICascade -->|Tier 2 - Key Pool Cascade| GeminiPool["Gemini 2.5 Pool (gemini-2.5-flash, gemini-2.5-flash-lite)"]
        AICascade -->|Tier 3 - Safety Net (grounded=false)| OfflineEngine["Offline Knowledge Engine (FastEngine)"]
    end
```

### End-to-End RAG Workflow
1. **Document Ingestion**: Users upload files (`PDF`, `DOCX`, `TXT`, `MD`, `PNG/JPG/WEBP`) or paste text in the **RAG Knowledge Base & Resume** modal (`Resume / CV`, `Job Description`, `Interview Notes`, `Technical Docs`).
2. **Parsing & Validation**: PDFs are parsed page-by-page (`pdf-parse`) to preserve exact page numbers; DOCX files are extracted via `mammoth`; images are transcribed via Gemini Vision. Empty (0-byte), corrupted, oversized (>5 MB), or unsupported files return explicit HTTP `400`/`413`/`415`/`422` errors.
3. **Overlapping Chunking**: Normalized text is split into overlapping chunks (default `RAG_CHUNK_SIZE=800` chars, `RAG_CHUNK_OVERLAP=150` chars) respecting paragraph and sentence boundaries, preserving `docId`, `ownerId`, `filename`, `docType`, `pageNumber`, and `sectionTitle`, and deduplicating identical chunks via SHA-256 content hashes.
4. **Semantic Embedding Generation**: Chunks are embedded in batches via `aiEngine.embedTexts()` using `gemini-embedding-001` (3072 dimensions, rotated across all configured Gemini API keys) or OpenAI `text-embedding-3-small`. Zero, NaN, or mismatched vectors are strictly rejected.
5. **Scoped Vector Retrieval**: On every question, the user's query is embedded and compared via exact cosine similarity against chunks owned exclusively by that user's session (`ownerId`). Top-`k` chunks (`RAG_TOP_K=4`) above `RAG_MIN_SCORE=0.30` are selected.
6. **Grounded Generation & Citations**: Retrieved passages are sanitized against prompt injection, wrapped in `<untrusted_document_context>`, and passed to the LLM with instructions to cite `[Source N: filename]`. The server emits `rag:contextUsed` (citations + grounding status) alongside the streamed answer.

---

## ⚙️ Environment Variables

Create a `.env` file in the root or `server/.env` using `.env.example` as a template:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Express & Socket.IO server port |
| `CORS_ORIGINS` | *(same-origin / dev)* | Comma-separated allowed CORS origins |
| `GEMINI_API_KEY` | — | Primary Google AI Studio API key (`AIza...`) |
| `GEMINI_API_KEY_1..3` | — | Additional Gemini API keys for automatic key-pool rotation |
| `OPENAI_KEY` | — | Optional OpenAI API key (`sk-...`) |
| `RAG_EMBEDDING_PROVIDER` | `auto` | Embedding provider selection: `auto`, `gemini`, or `openai` |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-001` | Primary Gemini embedding model (falls back to `gemini-embedding-2-preview`) |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | OpenAI embedding model when `OPENAI_KEY` is used |
| `RAG_CHUNK_SIZE` | `800` | Target chunk size in characters (bounded `200`–`4000`) |
| `RAG_CHUNK_OVERLAP` | `150` | Overlap between consecutive chunks in characters |
| `RAG_TOP_K` | `4` | Maximum number of relevant chunks retrieved per query |
| `RAG_MIN_SCORE` | `0.30` | Minimum cosine similarity threshold (`0.0`–`0.95`) |
| `RAG_MAX_CHUNKS_PER_DOC` | `200` | Safety cap on chunks indexed per document |
| `RAG_VECTOR_STORE_PATH` | *(in-memory per session)* | Optional file path for JSON snapshot persistence across restarts |

---

## 🚀 Getting Started Locally

```bash
# 1. Install workspace dependencies
npm install

# 2. Build frontend & start the full-stack server on http://localhost:3000
npm run dev
```

### Uploading Documents & Querying RAG
1. **Via the Web UI**:
   - Click **Docs & RAG** in the left sidebar (or **Docs (N)** in the Live Copilot Answer panel).
   - Select a category (`Resume / CV`, `Job Description`, `Interview Notes`, `Technical Docs`) and upload a `.pdf`, `.docx`, `.txt`, or `.md` file, or paste text.
   - Open the **Copilot** tab and speak or type a question in the input box (`Or type a question to query RAG / AI…`).
   - View the **Grounded in N passages** badge and click **Retrieved Source Citations** to inspect the exact filename, page number, section, cosine similarity score, and excerpt.
2. **Via REST API**:
   ```bash
   # Ingest a technical document into session "demo-session-1"
   curl -X POST http://localhost:3000/api/rag/documents \
     -H "Content-Type: application/json" \
     -H "x-session-id: demo-session-1" \
     -d '{
       "filename": "project_chronos_architecture.md",
       "docType": "technical_doc",
       "text": "# Architecture\nProject Chronos is a distributed settlement engine built in Go and Kubernetes using Raft consensus, reducing p99 latency from 410ms to 38ms."
     }'

   # Query the RAG pipeline
   curl -X POST http://localhost:3000/api/rag/query \
     -H "Content-Type: application/json" \
     -H "x-session-id: demo-session-1" \
     -d '{"question": "What p99 latency improvement did Project Chronos achieve?"}'
   ```

### Example Grounded RAG Response
- **Question**: `"What p99 latency improvement did Project Chronos achieve and what technologies were used?"`
- **Retrieved Context**: `[Source 1: project_chronos_architecture.md | Page 1 | Section: Architecture | Score: 0.78]`
- **Grounded Answer**:
  > According to your uploaded architecture document `[Source 1: project_chronos_architecture.md]`, **Project Chronos** reduced p99 settlement latency from **410ms to 38ms** across 12 global regions. It was built in **Golang** and **Kubernetes**, utilizing **Raft consensus** and **pgvector**.

---

## 🔒 Data Privacy, Multi-Tenancy & Retention
- **Strict Per-Session Isolation**: Every uploaded document and embedding chunk is keyed by the client's `ownerId` (`socket.id` or `x-session-id`). Retrieval queries and delete/re-index operations strictly filter by `ownerId`.
- **Automatic Ephemeral Cleanup**: When a Socket.IO session disconnects (`destroySession`), its in-memory session state and RAG vector scope are automatically purged unless `RAG_VECTOR_STORE_PATH` persistence is explicitly enabled.
- **Zero Sensitive Content Logging**: Server logs record only structural metadata (`requestId`, `docType`, `chunkCount`, `dimensions`, `provider`) and never log raw document contents or API keys.

---

## 🧪 Testing & Verification Suites

```bash
# 1. Deterministic AI Engine unit tests (34 tests: error classification, key validation, circuit breakers)
npm run test:unit

# 2. RAG Pipeline unit & integration tests (12 tests: normalization, chunking, metadata, cosine math, retrieval, deletion, re-indexing, tenant isolation, prompt-injection defense, offline grounding integrity, persistence)
npm run test:rag

# 3. Multi-client session & RAG isolation tests (12 assertions across concurrent Socket.IO & REST clients)
npm run test:isolation

# 4. Run all deterministic & isolation suites
npm run test:all

# 5. Live end-to-end system release gate (verifies /health, /api/upload-resume, live RAG ingestion & grounded query, Socket.IO streaming, mock interview, and ATS scan)
npm run test:system
```
