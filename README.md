# 🎙️ Interview Copilot AI

> **A real-time AI interview preparation and assistance platform built with React, Node.js, Socket.IO, Google Gemini Cascade, and OpenAI.**

[![Live Frontend](https://img.shields.io/badge/Frontend-Vercel-black?style=flat&logo=vercel)](https://interview-copilot-aii.vercel.app/)
[![Live Backend](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat&logo=render)](https://interview-copilot-aii.onrender.com/health)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=flat&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue?style=flat&logo=react)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Interview Copilot AI combines live interview assistance, mock interviews, resume analysis, coding practice, and performance insights into a unified real-time workspace. The system is designed around low-latency bidirectional communication, streaming AI responses, browser speech input, multimodal screen context, and a hardened backend featuring dynamic multi-model/multi-key failover with an offline knowledge fallback.

---

## ✨ Features

- **Live AI Copilot** — Capture spoken interview questions in real time and receive structured, technically sound answers with clear reasoning.
- **Streaming Responses** — AI answers are streamed incrementally over Socket.IO using native async chunking for near-instant time-to-first-token.
- **Multi-Tier AI Cascade** — Intelligent 3-tier fallback chain (`OpenAI GPT-4o-mini` → `Gemini 2.5/2.0/1.5 Dynamic Pool` → `Offline FastEngine Knowledge Base`) with circuit breakers.
- **Stealth / Floating Mode** — Compact, non-intrusive floating heads-up display via the browser Document Picture-in-Picture API.
- **Speech Input & Jargon Correction** — Browser Web Speech API integrated with an expanded phonetic tech dictionary (`"re act"` → `React`, `"type script"` → `TypeScript`, `"no sequel"` → `NoSQL`).
- **Screen & Vision Analysis** — Multimodal screen frame capture and document OCR (PDF, DOCX, PNG, JPEG) powered by Gemini Vision.
- **Mock Interview Simulator** — Role-targeted technical and behavioral interview simulations with real-time feedback and STAR-method scoring.
- **ATS Resume Intelligence** — Automated resume parsing, skill extraction, ATS compatibility scoring (0-100), and job-targeted cover letter generation.
- **Coding Practice Workspace** — In-browser editor and interview sandbox for live coding challenges.
- **Speech Analytics** — Real-time telemetry monitoring word count, pace, and verbal filler frequencies.
- **Theme Support** — Full dark/light monochrome minimal aesthetic with Cluely-inspired design.

---

## 🏗️ System Architecture

```mermaid
graph TD
    Client["React 18 Client (Vite + Tailwind)"] -->|Socket.IO (WebSocket / Polling)| Server["Node.js / Express 5 Server"]
    Client -->|HTTP POST /api/upload-resume| Server

    subgraph "Backend Engine"
        Server --> RateLimit["IP-Aware Rate Limiter & Security Middleware"]
        RateLimit --> SessionMap["Per-Socket Isolated Session Store"]
        SessionMap --> AICascade["Unified AIEngine Orchestrator"]
    end

    subgraph "AI Failover Cascade"
        AICascade -->|Tier 1| OpenAI["OpenAI (gpt-4o-mini)"]
        AICascade -->|Tier 2 - Cascade| GeminiPool["Gemini Dynamic Pool (2.5-flash, 2.0-flash, 1.5-flash, 1.5-pro)"]
        AICascade -->|Tier 3 - Safety Net| OfflineEngine["Offline Knowledge Engine (FastEngine)"]
    end
```

### Real-Time Flow
1. **Speech & Screen Capture**: The React client captures audio transcription and optional screen frames.
2. **Socket Transmission**: Payload is dispatched to the backend over an encrypted Socket.IO connection.
3. **Session & Rate-Limit Check**: The server validates payload bounds, checks per-operation IP rate limits, and routes to the connection's isolated session.
4. **Provider Routing**: The `AIEngine` invokes the active provider tier. If external APIs time out or hit quota limits, the request fails over seamlessly to alternative models and keys.
5. **Streaming Output**: Chunks stream back to the UI in real time, with an indicator distinguishing live AI generation from offline mode.
6. **Cancellation & Cleanup**: Disconnects or client navigation abort the underlying SDK request via native `AbortSignal`, preventing wasted quota and memory leaks.

---

## 🧰 Tech Stack

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS & Lucide React
- **Real-time**: Socket.IO Client
- **Browser APIs**: Web Speech Recognition, Document Picture-in-Picture

### Backend
- **Runtime**: Node.js 18+ & Express 5
- **Networking**: Socket.IO (WebSocket & Polling transports)
- **Security**: Helmet, CORS origin restriction, in-memory IP rate-limiting
- **File & OCR**: Multer, Mammoth, PDFParse

### AI & LLM Infrastructure
- **SDKs**: Official `@google/genai` (v2.29.1) & OpenAI SDK (v4)
- **Cascade**: Multi-key rotation, TTL circuit-breakers, model fallback
- **Offline Engine**: Deterministic regex & keyword-indexed knowledge base

---

## 📁 Project Structure

```text
interview_copilot_aii/
├── client/                      # React frontend
│   ├── src/
│   │   ├── components/          # Dashboard, Copilot, SpeechInput, StealthOverlay, etc.
│   │   ├── hooks/               # Custom hooks (e.g., useTheme)
│   │   ├── lib/                 # Utility functions & local storage
│   │   ├── App.jsx              # Main application root
│   │   └── index.css            # Global styling & Tailwind tokens
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── server/                      # Node.js backend
│   ├── ai_engine.js             # Unified 3-tier AIEngine, cascade & validation logic
│   ├── server.js                # Express & Socket.IO server, session isolation & endpoints
│   ├── .env.example             # Clean environment template (no secrets)
│   └── package.json
├── tests/                       # Deterministic regression & verification suites
│   ├── ai_engine.test.js        # Deterministic unit tests (34 tests)
│   ├── isolation_two_client.js  # Multi-client session isolation tests (10 tests)
│   └── system_verify.js         # End-to-end integration & release gate test
├── DEPLOYMENT.md                # Cloud deployment & health verification guide
├── package.json                 # Top-level workspace scripts
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- A Google Gemini API key and/or OpenAI API key (optional — works out-of-the-box in offline mode)

### 1. Clone the repository
```bash
git clone https://github.com/Lavish911/interview_copilot_aii.git
cd interview_copilot_aii
```

### 2. Configure Environment Variables
Copy the template into `server/.env`:
```bash
cp server/.env.example server/.env
```
Add your credentials to `server/.env`:
```env
PORT=3000
GEMINI_API_KEY=your_gemini_key_here
# Optional additional fallback keys
# GEMINI_API_KEY_SECONDARY=your_secondary_key
# GEMINI_API_KEY_1=your_key_1
# OPENAI_KEY=sk-...
```
> ⚠️ **SECURITY WARNING**: Never commit `.env` or real API keys to Git. The repository is pre-configured with strict `.gitignore` rules.

### 3. Install & Start Backend
```bash
cd server
npm install
npm run dev
```
The server will boot on `http://localhost:3000`. You can check health at `http://localhost:3000/health`.

### 4. Install & Start Frontend
In a separate terminal:
```bash
cd client
npm install
npm run dev
```
Open the local Vite URL (typically `http://localhost:5173`) in your browser.

---

## 🧪 Testing & Quality Gates

The test architecture ensures zero regression without consuming live AI quota during routine development:

```bash
# 1. Run deterministic unit & mock tests (34 tests covering error classification, validation, timeouts & circuit breakers)
npm run test:unit

# 2. Run multi-client session isolation regression tests (10 tests validating socket session privacy)
npm run test:isolation

# 3. Run all deterministic tests sequentially
npm run test:all

# 4. End-to-end live release gate (requires running backend)
npm run test:system
```

---

## 🔐 Security & Architecture Highlights

- **Zero Secret Commits**: Strict root `.gitignore` ignores all `.env*` files and local artifacts.
- **Credential Masking**: Logs format key identifiers as `key_N_of_M`, never printing raw credential tokens.
- **Session Privacy**: Socket sessions are isolated per connection ID; user resumes and settings never leak across clients.
- **Bounded Resources**: Express and Socket.IO enforce a 5MB payload limit and per-operation rate-limiting.
- **Bounded Timeouts**: All AI calls feature bounded 15s timeouts linked directly to underlying `AbortSignal` cancellation.

---

## 🌐 Production Deployment

- **Backend (Render)**: Set Root Directory to `server`, Build Command `npm install`, Start Command `node server.js`. Configure `GEMINI_API_KEY` in environment variables.
- **Frontend (Vercel)**: Set Root Directory to `client`, Framework Preset `Vite`, Build Command `npm run build`, Output Directory `dist`. Configure `VITE_SOCKET_URL` to point to your backend.

## 🧠 Engineering Highlights

This project focuses on robust engineering beyond simple LLM calls:
- **Low-Latency Streaming**: Incremental AI response streaming over Socket.IO chunk-by-chunk.
- **Resilient Fallback Cascade**: Automatic multi-tier failover (`OpenAI` → `Gemini` → `Offline FastEngine`).
- **Connection Isolation**: Per-socket private sessions preventing user data contamination.
- **Multimodal Context**: Browser speech recognition with technical phonetic correction, plus screen capture and OCR.
- **Enterprise Hygiene**: Strict secret boundaries, circuit-breaker rate limits, and health/readiness endpoints.

---

## 📌 Current Scope

Interview Copilot AI is an engineering portfolio project showcasing modern real-time AI architecture. Features such as stealth overlay and external AI integrations depend on browser API support (Document Picture-in-Picture, Web Speech API) and configured provider credentials. When external credentials are unavailable or rate-limited, the system seamlessly transitions to its built-in offline knowledge engine.

---

## 👨‍💻 Author

**Lavish Rahangdale**<br>
AI/ML Engineer · Full-Stack Developer

- **Portfolio**: [chic-cupcake-e22e59.netlify.app](https://chic-cupcake-e22e59.netlify.app/)
- **GitHub**: [@Lavish911](https://github.com/Lavish911)
- **Repository**: [interview_copilot_aii](https://github.com/Lavish911/interview_copilot_aii)
