# 🎙️ Interview Copilot AI

> **Real-time AI-powered technical interview assistant & career simulation platform.**
> Built with React 18, Node.js / Express 5, Socket.IO, Google Gemini Cascade, and OpenAI.

[![Live Frontend](https://img.shields.io/badge/Frontend-Vercel-black?style=flat&logo=vercel)](https://interview-copilot-aii.vercel.app/)
[![Live Backend](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat&logo=render)](https://interview-copilot-aii.onrender.com/health)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=flat&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue?style=flat&logo=react)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Key Highlights

- **Multi-Tier AI Cascade**: Intelligent fallback chain (`OpenAI GPT-4o-mini` → `Gemini 2.0/1.5 Pool` → `Offline FastEngine Knowledge Base`) with TTL-based key circuit-breakers.
- **Stealth Picture-in-Picture (PiP)**: Chrome Document Picture-in-Picture API overlay delivering non-intrusive, heads-up interview assistance with live speech-to-text.
- **Multimodal Screen & Vision OCR**: Captures active screen frames or uploaded documents (PDF, DOCX, PNG, JPEG) and extracts context with Gemini Vision & OCR.
- **Real-Time Speech Jargon Auto-Correct**: Integrated browser Web Speech API with an expanded technical phonetic dictionary (`"re act"` → `React`, `"type script"` → `TypeScript`, `"no sequel"` → `NoSQL`).
- **ATS Resume Intelligence**: Upload your resume to extract bullet points, match against target job descriptions, receive ATS scoring (0-100), and auto-generate tailored cover letters.
- **Full-Stack Security & Isolation**: Helmet HTTP headers, origin-restricted CORS, rate limiting, bounded payload sizes, per-socket session isolation, and strict secret hygiene.

---

## 📐 System Architecture

```mermaid
graph TD
    Client["React 18 Client (Vite + Tailwind)"] -->|Socket.IO (WebSocket / Polling)| Server["Node.js / Express 5 Server"]
    Client -->|HTTP POST /api/upload-resume| Server

    subgraph "Backend Engine"
        Server --> RateLimit["Socket Rate Limiter & Validator"]
        RateLimit --> SessionMap["Per-Socket Session Store"]
        SessionMap --> AICascade["AI Cascade Orchestrator"]
    end

    subgraph "AI Failover Cascade"
        AICascade -->|Tier 1| OpenAI["OpenAI gpt-4o-mini"]
        AICascade -->|Tier 2 - Failover| GeminiPool["Gemini Dynamic Key Pool (2.0-flash, 1.5-flash, 1.5-pro)"]
        AICascade -->|Tier 3 - Safety Net| OfflineEngine["Offline Technical Knowledge Engine"]
    end
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+ installed
- At least one Google Gemini API key or OpenAI API key

### 1. Clone the repository
```bash
git clone https://github.com/Lavish911/interview_copilot_aii.git
cd interview_copilot_aii
```

### 2. Configure Environment Variables
Copy the template in the `server` directory:
```bash
cp server/.env.example server/.env
```
Open `server/.env` and insert your API key(s):
```env
PORT=3000
GEMINI_API_KEY="your_gemini_api_key_here"
# Optional secondary fallback keys
# GEMINI_API_KEY_SECONDARY="your_backup_gemini_key"
# OPENAI_KEY="sk-..."
```

> ⚠️ **SECURITY WARNING**: Never commit `.env` to Git. The repository includes a `.gitignore` configured to prevent accidental leakage of environment files.

### 3. Install Dependencies & Run

**Start the Backend:**
```bash
cd server
npm install
npm run dev
```
The server will boot on `http://localhost:3000`. You can verify health at `http://localhost:3000/health`.

**Start the Frontend:**
```bash
cd ../client
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Testing & Verification

The project separates deterministic offline testing from live integration release gating:

### 1. Deterministic Unit & Mock Tests (No API credentials required)
Runs 19 deterministic tests validating error classification, opaque logging, format validation, circuit breakers, and mock failover:
```bash
npm test
# or
npm run test:unit
```

### 2. Multi-Client Session Isolation Regression Suite
Verifies that independent Socket.IO connections maintain strictly isolated sessions, settings, and resume state without cross-contamination:
```bash
npm run test:isolation
```

### 3. Run All Deterministic Tests
```bash
npm run test:all
```

### 4. End-to-End Live System Verification & Release Gate
Executes live API and fallback integration tests against an active backend server:
```bash
# Ensure server is running on port 3000
npm run test:system
```

**Release Gate Exit Codes**:
- `Exit Code 0`: 100% verified — real live AI provider generated answers.
- `Exit Code 2`: BLOCKED — all infrastructure and offline fallbacks passed, but live AI credentials are missing, rejected, or invalid format (`AQ.` OAuth tokens).
- `Exit Code 1`: FAILED — genuine system regression or assertion failure.

---

## 🔐 Security & Secret Rotation Notice

### Secret Hygiene Measures
- **Ignored Secrets**: Root `.gitignore` strictly ignores all `.env`, `**/.env`, and credential patterns.
- **Safe Environment Template**: Clean `server/.env.example` provides documented placeholders without real keys.
- **Isolated Sessions**: Global shared session state has been replaced by per-socket session maps (`Map<socketId, Session>`). User resumes and settings are strictly private to their connection.
- **Strict Headers & CORS**: Integrated `helmet` and origin-restricted CORS preventing unauthorized cross-origin socket connections.
- **Payload Limits**: 5MB buffer limit on Socket.IO frames and Multer file uploads.

### How to Rotate Compromised Keys
If an API key was previously pushed to a public repository:
1. Visit the [Google AI Studio API Keys Console](https://aistudio.google.com/app/apikey).
2. Locate any keys previously used and click **Delete / Revoke**.
3. Generate a **Create new API Key**.
4. In your hosting provider (e.g. Render Dashboard):
   - Navigate to **Environment**.
   - Update `GEMINI_API_KEY` with the new value.
5. In your local development machine:
   - Update your local untracked `server/.env`.
   - Never stage `.env` with `git add`.

---

## 🌐 Production Deployment

### Backend on Render
- **Build Command**: `npm install`
- **Start Command**: `node server.js`
- **Root Directory**: `server`
- **Environment Variables**:
  - `PORT`: `3000`
  - `GEMINI_API_KEY`: *(Your key)*
  - `CORS_ORIGINS`: `https://interview-copilot-aii.vercel.app`

### Frontend on Vercel
- **Framework Preset**: `Vite`
- **Root Directory**: `client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
