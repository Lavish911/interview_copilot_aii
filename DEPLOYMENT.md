# 🌍 Deployment Guide — Interview Copilot AI

This guide walks you through deploying the Interview Copilot AI platform to **Vercel** (Frontend) and **Render** (Backend).

---

## 🛠️ Architecture Overview

| Component | Host | URL |
|---|---|---|
| **Frontend** | Vercel | `https://interview-copilot-aii.vercel.app` |
| **Backend** | Render | `https://interview-copilot-aii.onrender.com` |
| **Health Check** | Render | `https://interview-copilot-aii.onrender.com/health` |

---

## 🚀 Part 1: Deploy Backend to Render

1. Log into your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository (`Lavish911/interview_copilot_aii`).
4. Configure the service settings:
   - **Name**: `interview-copilot-aii` (or custom)
   - **Region**: Oregon or closest to your audience
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. Configure **Environment Variables**:
   | Variable | Value | Purpose |
   |---|---|---|
   | `PORT` | `3000` | Port for Express/Socket.IO server |
   | `GEMINI_API_KEY` | *(Your Gemini API key)* | Primary AI reasoning key |
   | `GEMINI_API_KEY_SECONDARY` | *(Optional backup key)* | Fallback key for rate-limiting |
   | `CORS_ORIGINS` | `https://interview-copilot-aii.vercel.app` | Allowed frontend domains |
6. Click **Deploy Web Service**.
7. Test the health and readiness endpoints once deployed:
   ```bash
   curl https://interview-copilot-aii.onrender.com/health
   curl https://interview-copilot-aii.onrender.com/health/ready
   ```
   **Liveness Check (`/health`)**: Always returns HTTP 200 indicating the Node.js process is healthy:
   ```json
   {
     "status": "ok",
     "uptime": 120,
     "providers": {
       "openai": { "configured": false, "formatValid": false, "liveVerified": false, "status": "NOT_CONFIGURED" },
       "gemini": { "configured": true, "formatValid": true, "keysConfigured": 1, "keysFormatValid": 1, "keysActive": 1, "liveVerified": true, "status": "LIVE_VERIFIED" },
       "liveAIReady": true,
       "activeTier": "gemini",
       "offlineAvailable": true
     },
     "connections": 0
   }
   ```

   **Readiness Check (`/health/ready`)**: Returns HTTP 200 only when live AI generation is verified:
   - HTTP 200: `{"ready":true,"status":"LIVE_READY","message":"Live AI provider is verified and ready"}`
   - HTTP 503: `{"ready":false,"status":"FORMAT_VALID_UNVERIFIED","message":"..."}` (unverified)
   - HTTP 503: `{"ready":false,"status":"NOT_CONFIGURED","message":"..."}` (offline mode)

### Provider Health Status Meanings:
- `NOT_CONFIGURED`: No credential string provided.
- `PLACEHOLDER`: Detected template placeholder string.
- `INVALID_FORMAT_OAUTH_TOKEN`: Key starts with `AQ.` (OAuth/Vertex token unsupported by Google AI Studio).
- `INVALID_CREDENTIAL_FORMAT`: Key does not match syntax requirements (`sk-...` or `AIzaSy...`).
- `FORMAT_VALID_UNVERIFIED`: Key matches syntax requirements; live network availability not yet confirmed.
- `LIVE_VERIFIED`: Provider has successfully generated at least one live AI response.
- `AUTH_FAILED`: Provider rejected credentials (HTTP 401/403). Circuit breaker engaged.
- `ALL_KEYS_EXHAUSTED_COOLDOWN`: All configured keys are in temporary cooldown from rate limits (HTTP 429).

> 💡 **Note on Horizontal Scaling**: In-memory rate limiting is bound per Node.js process. In multi-instance deployments (e.g. multiple Render or Kubernetes pods), a shared Redis store is required for global limits across pods.
> 💡 **Note on Render Free Tier**: Free tier instances spin down after 15 minutes of inactivity. When cold, the first request may take 30–60 seconds to respond. The frontend displays a connection status badge (`Connecting to Backend...`) to guide the user while the server wakes up.

---

## ⚡ Part 2: Deploy Frontend to Vercel

1. Log into your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** → **Project**.
3. Import your GitHub repository (`interview_copilot_aii`).
4. In the Project Configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and choose `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Configure **Environment Variables** (Optional):
   | Variable | Value | Purpose |
   |---|---|---|
   | `VITE_SOCKET_URL` | `https://interview-copilot-aii.onrender.com` | Backend URL (defaults to this if omitted in production) |
6. Click **Deploy**.
7. Vercel will build and assign your production domain: `https://interview-copilot-aii.vercel.app`.

---

## 🔒 Part 3: Post-Deployment Verification & Security Checklist

- [ ] Verify that `server/.env` is NOT visible in the GitHub repository.
- [ ] Confirm `/health` on Render returns `{"status":"ok"}`.
- [ ] Open the Vercel app in Chrome.
- [ ] Check the status indicator in the top-left sidebar: Should turn green (`Backend Connected` and `🤖 AI Provider: Gemini Active`).
- [ ] Verify microphone permissions and test a spoken query (e.g., *"What is the Virtual DOM in React?"*).
- [ ] Test the Document Picture-in-Picture mode by clicking **Enter Stealth Mode**.
- [ ] Test uploading a PDF resume in **Context** modal.
