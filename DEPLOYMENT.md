# 🌍 How to Make Interview Copilot LIVE (Deployment Guide)

Since this is a full-stack application (React + Node.js), you need to deploy the **Frontend** and **Backend** separately.

---

## 🚀 Option 1: The "Hobby" Stack (Free)

### Part A: Deploy Server (Backend) -> **Render.com**
1.  Create a GitHub repository and push this code.
2.  Sign up at [Render.com](https://render.com).
3.  Click **New +** -> **Web Service**.
4.  Connect your GitHub repo.
5.  **Root Directory**: `server`
6.  **Build Command**: `npm install`
7.  **Start Command**: `node server.js`
8.  **Environment Variables**: Add `GEMINI_API_KEY`.
9.  Click **Deploy**.
    *   *Note URL*: e.g., `https://interview-copilot-api.onrender.com`

### Part B: Deploy Client (Frontend) -> **Vercel**
1.  Go to `client/src/App.jsx` and change:
    ```javascript
    const SOCKET_URL = "https://interview-copilot-api.onrender.com"; // Your Render URL
    ```
2.  Push changes to GitHub.
3.  Sign up at [Vercel.com](https://vercel.com).
4.  **Add New** -> **Project** -> Import Repo.
5.  **Root Directory**: Edit -> Select `client`.
6.  **Framework Preset**: Vite.
7.  Click **Deploy**.

---

## ⚡ Option 2: The "Demo" Way (ngrok)
*Fastest way to show a friend without deploying.*

1.  Download **ngrok**.
2.  Term 1: Start Server (`node server.js`).
3.  Term 2: Start Client (`npm run dev`).
4.  Term 3: Run ngrok:
    ```bash
    ngrok http 5173
    ```
5.  Share the `https://....ngrok-free.app` link.
    *   *Note*: For the backend to work remotely, you also need to tunnel port 3000 (`ngrok http 3000`) and update the Client to point to that URL.

---

## 📦 Zip Handover
This folder contains the complete source code. 
**Note**: `node_modules` are excluded to save space. Run `npm install` in both `client` and `server` folders to restore them.
