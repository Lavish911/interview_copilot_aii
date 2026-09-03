# Interview Copilot AI

> A real-time AI interview preparation and assistance platform built with React, Node.js, Socket.IO, and Gemini/OpenAI APIs.

Interview Copilot AI combines live interview assistance, mock interviews, resume analysis, coding practice, and performance insights in one workspace. The system is designed around low-latency communication, streaming AI responses, browser-based speech input, screen context, and a Node.js backend with multi-model AI fallbacks.

## ✨ Features

- **Live AI Copilot** — capture spoken questions and receive structured AI responses in real time.
- **Streaming responses** — AI answers can be streamed incrementally over Socket.IO instead of waiting for the full response.
- **Speech input** — browser speech recognition feeds interview context into the copilot.
- **Screen context** — optional screen capture provides additional visual context to the AI workflow.
- **Mock interviews** — generate and practice technical and behavioral interview questions.
- **Resume analysis** — upload a resume and analyze it for interview preparation and improvement opportunities.
- **Coding workspace** — practice coding questions inside the application.
- **Analytics** — review interview and preparation insights.
- **Stealth / floating mode** — use a compact floating interface through the browser's Document Picture-in-Picture API when supported.
- **AI provider fallback** — Gemini models are tried through a configurable fallback chain, with OpenAI support and an offline knowledge-engine fallback.
- **Dark / light mode** — theme switching is built into the application.

## 🏗️ Architecture

```text
┌──────────────────────────────┐
│          React Client        │
│                              │
│ Dashboard · Copilot · Mock   │
│ Resume · Code · Analytics    │
│ Speech · Screen · Stealth    │
└──────────────┬───────────────┘
               │
               │ Socket.IO / HTTP
               ▼
┌──────────────────────────────┐
│        Node.js Server        │
│                              │
│ Express · Socket.IO          │
│ File Processing · AI Router  │
└──────────────┬───────────────┘
               │
        ┌──────┴───────┐
        ▼              ▼
   Gemini APIs     OpenAI API
        │
        ▼
 Multi-model / multi-key
      fallback
        │
        ▼
 Offline Knowledge Engine
```

### Real-time flow

1. The React client captures speech and optional screen context.
2. Context is sent to the Node.js server through Socket.IO.
3. The server selects an available AI provider/model.
4. AI output can be streamed back to the client in chunks.
5. The UI progressively renders the response through the suggestion panel.
6. If external AI providers are unavailable, the server can fall back to its local knowledge engine.

## 🧰 Tech Stack

### Frontend
- React
- Vite
- Tailwind CSS
- Socket.IO Client
- Lucide React
- Browser Speech Recognition APIs
- Document Picture-in-Picture API

### Backend
- Node.js
- Express
- Socket.IO
- CORS
- Multer
- Mammoth
- PDF parsing
- dotenv

### AI
- Google Gemini API
- OpenAI API
- Multi-model fallback strategy
- Streaming generation
- Local knowledge-engine fallback

### Development & Deployment
- npm
- Vercel-compatible frontend configuration
- Render-compatible backend deployment
- Environment-based configuration

## 📁 Project Structure

```text
interview_copilot_aii/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── workers/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── vercel.json
├── server/
│   ├── server.js
│   ├── package.json
│   └── ...
├── DEPLOYMENT.md
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm
- A Gemini API key and/or OpenAI API key for live external AI generation

### 1. Clone the repository

```bash
git clone https://github.com/Lavish911/interview_copilot_aii.git
cd interview_copilot_aii
```

### 2. Install client dependencies

```bash
cd client
npm install
```

### 3. Install server dependencies

Open another terminal:

```bash
cd server
npm install
```

### 4. Configure environment variables

Create `server/.env` locally:

```env
OPENAI_KEY=your_openai_key_here
GEMINI_API_KEY=your_gemini_key_here
```

Additional Gemini fallback keys can be configured using the project's supported numbered variables, for example:

```env
GEMINI_API_KEY_1=your_key_here
GEMINI_API_KEY_2=your_key_here
```

**Never commit `.env` or real API keys to Git.**

### 5. Start the backend

```bash
cd server
npm start
```

### 6. Start the frontend

In another terminal:

```bash
cd client
npm run dev
```

Open the local Vite URL shown in the terminal.

## ⚙️ Configuration

The frontend automatically uses the local Socket.IO server during development and the configured production backend when built for production. The current production endpoint is configured in `client/src/App.jsx`.

The backend loads API credentials from environment variables and maintains a configurable Gemini model fallback chain. This allows the application to continue trying alternative models when a model is unavailable or temporarily rate-limited.

## 🔐 Security Notes

- API credentials are read from environment variables rather than hard-coded into the application.
- Keep production secrets in the deployment platform's environment-variable settings.
- Restrict CORS origins before deploying a production instance intended for real users.
- Review uploaded-file handling and authentication requirements before using the project with sensitive interview or resume data.

## 🧠 Engineering Highlights

This project focuses on more than simply calling an LLM API. Key engineering areas include:

- Real-time client/server communication with Socket.IO
- Incremental AI response streaming
- Multi-model and multi-key AI fallback handling
- Browser speech and screen-context integration
- File processing for resumes and documents
- Component-based React architecture
- Client/server separation for deployment
- Offline fallback behavior when external AI services are unavailable
- Environment-based secret management

## 📌 Current Scope

Interview Copilot AI is a portfolio and engineering project demonstrating real-time AI application architecture. Some features, including stealth/floating behavior and external AI integrations, depend on browser capabilities, deployment configuration, and available API providers.

## 👨‍💻 Author

**Lavish Rahangdale**

AI/ML Engineer · Full-Stack Developer

- Portfolio: https://chic-cupcake-e22e59.netlify.app/
- GitHub: https://github.com/Lavish911
