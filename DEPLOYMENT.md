# 🌍 Deployment Guide — Interview Copilot AI (with RAG Pipeline)

This guide walks you through deploying the Interview Copilot AI platform to **Vercel** (Frontend) and **Render** (Backend), or as a unified full-stack Node.js service.

---

## 🛠️ Architecture Overview

| Component | Host | URL |
|---|---|---|
| **Frontend** | Vercel (or built into Express `/client/dist`) | `https://interview-copilot-aii.vercel.app` |
| **Backend + RAG Engine** | Render | `https://interview-copilot-aii.onrender.com` |
| **Health & RAG Status** | Render | `https://interview-copilot-aii.onrender.com/health` |

---

## 🚀 Part 1: Deploy Backend to Render

1. Log into your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository (`Lavish911/interview_copilot_aii`).
4. Configure the service settings:
   - **Name**: `interview-copilot-aii`
   - **Branch**: `main`
   - **Root Directory**: `server` (or repository root if deploying unified full-stack)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Configure **Environment Variables**:
   | Variable | Value | Purpose |
   |---|---|---|
   | `PORT` | `3000` | Port for Express/Socket.IO server |
   | `GEMINI_API_KEY` | *(Your Gemini API key)* | Primary AI generation & `gemini-embedding-001` key |
   | `GEMINI_API_KEY_1..3` | *(Optional backup keys)* | Automatic key-pool rotation for generation & embeddings |
   | `OPENAI_KEY` | *(Optional `sk-...` key)* | Optional Tier-1 generation & `text-embedding-3-small` key |
   | `CORS_ORIGINS` | `https://interview-copilot-aii.vercel.app` | Allowed frontend domains |
   | `RAG_EMBEDDING_PROVIDER` | `auto` | `auto`, `gemini`, or `openai` |
   | `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-001` | Primary Gemini semantic embedding model |
   | `RAG_CHUNK_SIZE` | `800` | Target chunk size in characters |
   | `RAG_CHUNK_OVERLAP` | `150` | Chunk overlap in characters |
   | `RAG_TOP_K` | `4` | Top-K passages retrieved per question |
   | `RAG_MIN_SCORE` | `0.30` | Minimum cosine similarity threshold |
   | `RAG_VECTOR_STORE_PATH` | *(Optional path, e.g. `/var/data/rag_store.json`)* | Optional persistent disk snapshot path |

6. Verify the health and readiness endpoints once deployed:
   ```bash
   curl https://interview-copilot-aii.onrender.com/health
   curl https://interview-copilot-aii.onrender.com/health/ready
   ```
   The `/health` response includes `providers.embeddings` and `rag` telemetry (`documentsIndexed`, `chunksIndexed`, `defaultTopK`, `defaultMinScore`).

---

## ⚡ Part 2: Deploy Frontend to Vercel

1. Log into your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** → **Project** and import `interview_copilot_aii`.
3. Configure:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Set Environment Variable:
   - `VITE_SOCKET_URL`: `https://interview-copilot-aii.onrender.com`
5. Click **Deploy**.

---

## 🔒 Part 3: Post-Deployment Verification Checklist

- [ ] Confirm `/health` returns `{"status":"ok"}` with `providers.embeddings.ready: true`.
- [ ] Open the app and click **Docs & RAG** in the sidebar to upload a PDF/DOCX/TXT resume or technical note.
- [ ] Ask a question specific to your uploaded document in **Live Copilot** and verify the **Grounded in N passages** badge and expandable **Retrieved Source Citations**.
