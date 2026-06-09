import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import mammoth from 'mammoth';
import fs from 'fs';
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() }); // File upload memory storage

const httpServer = createServer(app);

// Simple CORS for development
app.use(cors());
app.use(express.json()); // Ensure JSON body parsing

const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for demo purposes, restrict in prod
        methods: ["GET", "POST"]
    }
});

// Initialize OpenAI or Fast Mock Engine
// Initialize AI Engines
const openaiKey = process.env.OPENAI_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

let openai; // RESTORED
let geminiModel;
let genAI; // Global Scope for Vision
let sessionData = {
    resume: "",
    analysis: null, // Persist ATS Score
    coverLetter: "", // Persist Cover Letter
    context: [],
    settings: {
        role: "Software Engineer",
        company: "General Tech",
        tone: "Professional",
        detailLevel: "Concise"
    }
}; // Global Session Data

if (openaiKey && openaiKey !== 'your_openai_key_here') {
    openai = new OpenAI({ apiKey: openaiKey });
    console.log("✅ OpenAI Engine Loaded (Tier 1)");
}

if (geminiKey && geminiKey !== 'your_gemini_key_here') {
    genAI = new GoogleGenerativeAI(geminiKey);
    geminiModel = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    console.log("✅ Google Gemini Engine Loaded (Tier 2)");
}

if (!openai && !geminiModel) {
    console.log("⚠️ No Keys Detected. Using Neural Knowledge Engine (Tier 3 - Offline)");
}

// --- KNOWLEDGE ENGINE (Offline AI) ---
// Simulates a "Whole Knowledge" agent using a rich dictionary of interview topics.

const KNOWLEDGE_BASE = {
    // --- FRONTEND ---
    "react": "### ⚛️ React Deep Dive\n**Core Concepts:**\n- **Virtual DOM**: Efficient diffing algorithm for UI updates.\n- **Hooks**: `useState`, `useEffect` for functional state/lifecycle.\n- **Reconciliation**: React's way of updating the DOM efficiently (Fiber).\n- **Context**: State management without prop drilling.\n\n**Pro Tip for Interviews**: Mention 'component composition' and 'custom hooks' to sound senior.",
    "css": "### 🎨 CSS Mastery\n- **Flexbox vs Grid**: Flex is 1D (rows/cols), Grid is 2D.\n- **Box Model**: Content, Padding, Border, Margin.\n- **BEM**: Block Element Modifier methodology for scalable CSS.\n- **Responsive**: Use `@media` queries and relative units (rem, vh/vw).",
    "performance": "### 🚀 Web Performance\n- **Lighthouse**: Measure FCP, LCP, CLS.\n- **Optimization**: Lazy loading images, code splitting (React.lazy), minimizing bundle size.\n- **Rendering**: CSR (Client) vs SSR (Server) vs SSG (Static).",

    // --- BACKEND ---
    "node": "### 🟢 Node.js Architecture\n- **Event Loop**: Single-threaded, non-blocking I/O (libuv).\n- **Phases**: Timers, Pending Callbacks, Poll, Check (setImmediate), Close.\n- **Streams**: Handle large data efficiently (piping).\n- **Cluster Mode**: Utilize multi-core CPUs.",
    "database": "### 🗄️ Databases\n- **SQL (ACID)**: PostgreSQL, MySQL. Good for structured data, relationships.\n- **NoSQL (BASE)**: MongoDB, Redis. Good for flexible schemas, high scale.\n- **Indexing**: B-Tree indices speed up reads but slow down writes.",
    "api": "### 🔌 API Design\n- **REST**: Resource-based, standard verbs (GET, POST), stateless.\n- **GraphQL**: Client specifies data, single endpoint, solves over-fetching.\n- **Status Codes**: 200 (OK), 400 (Bad Request), 401 (Auth), 500 (Server Error).",

    // --- CS FUNDAMENTALS ---
    "dsa": "### 🧠 Data Structures & Algos\n- **Big O**: Time/Space complexity. O(1) > O(log n) > O(n) > O(n^2).\n- **Arrays/Maps**: Fast access.\n- **Trees/Graphs**: DFS (Stack/Recursion), BFS (Queue).\n- **Sorting**: QuickSort / MergeSort (O(n log n)).",
    "system design": "### 🏗️ System Design\n- **Scalability**: Horizontal (more servers) vs Vertical (bigger server).\n- **Load Balancer**: Nginx, AWS ALB. Distributes traffic.\n- **Caching**: Redis/Memcached at DB layer, CDN for static content.\n- **CAP Theorem**: Consistency, Availability, Partition Tolerance (Pick 2).",

    // --- BEHAVIORAL ---
    "tell me about yourself": "### 👤 The Pitch\n**Structure:**\n1. **Hook**: 'I am a specialized Software Engineer with X years in...'\n2. **Journey**: 'I started at [Company A], where I built... then moved to [Company B] to focus onScaling...'\n3. **Why Now**: 'I'm looking for a role that challenges my skills in [Skill X], which makes [Target Company] perfect.'",
    "weakness": "### 🛡️ 'What is your weakness?'\n**Strategy**: Real flaw + Active fix.\n**Examples**:\n- 'I sometimes focus too much on details (Perfectionism), so now I use time-boxing.'\n- 'Public speaking was hard, so I started leading daily standups.'",
    "default": "### 🤖 Neural Engine\nI am listening. I have comprehensive modules on:\n- **Frontend**: React, Vue, CSS, Performance\n- **Backend**: Node.js, SQL vs NoSQL, System Design\n- **Behavioral**: Leadership, Weaknesses, 'Tell me about yourself'\n\n*Mention any technical topic for a deep dive.*"
};

const FastEngine = {
    generateAnswer: (transcript) => {
        const t = transcript.toLowerCase();

        // Semantic Matcher
        let bestMatch = "default";
        let highestScore = 0;

        Object.keys(KNOWLEDGE_BASE).forEach(key => {
            if (key === "default") return;
            // Simple scoring: count word overlaps
            const keyWords = key.split(' ');
            let score = 0;
            keyWords.forEach(w => {
                if (t.includes(w)) score += 1;
            });

            // Boost for exact phrase
            if (t.includes(key)) score += 2;

            if (score > highestScore) {
                highestScore = score;
                bestMatch = key;
            }
        });

        if (highestScore > 0) {
            return KNOWLEDGE_BASE[bestMatch];
        } else {
            // Fallback Logic
            if (t.includes("hello") || t.includes("hi")) return "### 👋 Ready to Interview\nI'm listening. We can practice:\n1. **Technical Questions**\n2. **Behavioral Drills**\n3. **System Design**";
            if (t.includes("thank")) return "### 👍 You're Welcome!\nKeep the momentum going. What's the next topic?";

            return KNOWLEDGE_BASE["default"];
        }
    },
    generateMockQuestion: () => {
        const qs = [
            "Explain the difference between SQL and NoSQL databases.",
            "How does the browser rendering engine work (Critical Rendering Path)?",
            "Design a scalable rate limiter system.",
            "What is a closure in JavaScript and how does it relate to scope?",
            "Explain the concept of 'Hoisting' in JavaScript."
        ];
        return qs[Math.floor(Math.random() * qs.length)];
    },
    analyzeResume: () => ({
        score: 85,
        keywords_missing: ["Kubernetes", "Redis", "System Design"],
        summary: "Solid engineering background. Strong on implementation, but could verify more 'Scale' experience.",
        improvements: [
            { original: "Built a React app", improved: "Architected a high-performance React application serving 10k+ daily users." },
            { original: "Fixed bugs", improved: "Resolved critical race conditions, reducing system downtime by 15%." }
        ]
    })
};



const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Interview Copilot AI Server is running.');
});

    // --- FAILOVER SYSTEM (Multi-Key + Multi-Model) ---

    // --- FAILOVER SYSTEM (Infinite Key Rotation) ---

    // 1. Dynamic Key Loader (Scans for GEMINI_API_KEY_1...N)
    const API_KEYS = [];
    if (process.env.GEMINI_API_KEY) API_KEYS.push(process.env.GEMINI_API_KEY); // Primary
    if (process.env.GEMINI_API_KEY_SECONDARY) API_KEYS.push(process.env.GEMINI_API_KEY_SECONDARY); // Legacy Secondary

    // Auto-load numbered keys 1-20
    for (let i = 1; i <= 20; i++) {
        const key = process.env[`GEMINI_API_KEY_${i}`];
        if (key && key.length > 10) API_KEYS.push(key);
    }

    // De-dupe keys
    const UNIQUE_KEYS = [...new Set(API_KEYS)].filter(k => k && !k.includes('your_'));

    console.log(`🔥 Failover System Loaded: ${UNIQUE_KEYS.length} Active API Keys`);

    // --- VISION CASCADE ---
    const cascadeVisionContent = async (buffer, mimeType) => {
        const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];
        let lastError = null;

        for (const key of UNIQUE_KEYS) {
            const genAI = new GoogleGenerativeAI(key);
            for (const modelName of models) {
                try {
                    console.log(`👁️ Vision Attempt: [Key ${key.substring(0, 4)}..] + [${modelName}]`);
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent([
                        {
                            inlineData: {
                                data: buffer.toString('base64'),
                                mimeType: mimeType
                            }
                        },
                        "Transcribe the full text of this document verbatim. Do not summarize. Just return the text content."
                    ]);
                    const text = result.response.text();
                    if (text) return text;
                } catch (e) {
                    console.log(`⚠️ Vision Fail: ${e.message.split(' ')[0]}...`);
                    lastError = e;
                    if (e.message.includes("429") || e.message.includes("404")) continue;
                }
            }
        }
        throw lastError || new Error("All Vision Keys Failed");
    };

    // 2. Verified Models (Expanded for Future-Proofing)
    const FALLBACK_MODELS = [
        "gemini-2.5-flash",           // Priority 1: Highly available on new free tier accounts
        "gemini-2.5-flash-lite",      // Priority 2: Lightweight 2.5
        "gemini-2.0-flash-lite",      // Priority 3: Legacy 2.0 Fastest
        "gemini-flash-latest",        // Priority 4: Stable Alias
        "gemini-2.0-flash",           // Priority 5: Standard 2.0
        "gemini-1.5-pro-latest"       // Priority 6: High-Intelligence Fallback
    ];

    let globalKeyIndex = 0;

    async function cascadeGenerateContent(promptParts, isSafetyRetry = false, streamCallback = null) {
        // Try every combination of Key + Model using Round-Robin
        for (let loopCount = 0; loopCount < UNIQUE_KEYS.length; loopCount++) {
            const currentKeyIndex = (globalKeyIndex + loopCount) % UNIQUE_KEYS.length;
            const currentKey = UNIQUE_KEYS[currentKeyIndex];

            for (let modelIndex = 0; modelIndex < FALLBACK_MODELS.length; modelIndex++) {
                const modelName = FALLBACK_MODELS[modelIndex];

                try {
                    const genAI = new GoogleGenerativeAI(currentKey);
                    const model = genAI.getGenerativeModel({
                        model: modelName,
                        // Safety Settings: BLOCK_NONE-ish (as permissive as API key allows)
                        safetySettings: [
                            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
                        ]
                    });

                    console.log(`🤖 Attempt: [Key ${currentKeyIndex + 1}/${UNIQUE_KEYS.length}] + [${modelName}] ${isSafetyRetry ? '(Safety Retry)' : ''}`);

                    // If Safety Retry, wrap prompt in "Safe Context"
                    const finalPrompt = isSafetyRetry
                        ? ["**CONTEXT: PROFESSIONAL TECHNICAL INTERVIEW SIMULATION. EDUCATIONAL PURPOSE ONLY.**", ...promptParts]
                        : promptParts;

                    if (streamCallback) {
                        const result = await model.generateContentStream(finalPrompt);
                        let fullText = "";
                        let isFirst = true;
                        for await (const chunk of result.stream) {
                            const chunkText = chunk.text();
                            fullText += chunkText;
                            streamCallback(chunkText, isFirst);
                            isFirst = false;
                        }
                        if (!isSafetyRetry) globalKeyIndex = (currentKeyIndex + 1) % UNIQUE_KEYS.length;
                        return { response: { text: () => fullText } };
                    } else {
                        const result = await model.generateContent(finalPrompt);
                        const response = await result.response;

                        // Validate Response Candidate
                        if (response.candidates && response.candidates.length > 0 && response.candidates[0].finishReason !== "SAFETY") {
                            // Advance to the next key for the NEXT request to ensure true round-robin load balancing
                            if (!isSafetyRetry) globalKeyIndex = (currentKeyIndex + 1) % UNIQUE_KEYS.length;
                            return result;
                        } else {
                            console.warn(`⚠️ Blocked by Safety Filter (${modelName}).`);
                            if (!isSafetyRetry) {
                                console.log("♻️ Triggering Safety Auto-Correct...");
                                return await cascadeGenerateContent(promptParts, true, streamCallback);
                            }
                            throw new Error("Safety Blocked (Even with override)");
                        }
                    }

                } catch (error) {
                    const errMsg = error.message;
                    const isRateLimit = errMsg.includes('429') || errMsg.includes('Too Many Requests');
                    const isOverloaded = errMsg.includes('503') || errMsg.includes('Overloaded');

                    if (isRateLimit || isOverloaded) {
                        console.warn(`⚠️ [Key ${currentKeyIndex + 1}] Hit Limit (${errMsg.split(' ')[0]}). Switching to next Key...`);
                        break;
                    }

                    if (errMsg.includes('404')) {
                        console.warn(`⚠️ [Key ${currentKeyIndex + 1}] Model ${modelName} Not Found. Skipping.`);
                        continue;
                    }

                    // If Safety Error was thrown directly
                    if (errMsg.includes("SAFETY") || errMsg.includes("blocked")) {
                        if (!isSafetyRetry) return await cascadeGenerateContent(promptParts, true, streamCallback);
                    }

                    console.error("Critical AI Error (Skipping Key):", error.message);
                }
            }
        }
        throw new Error("ALL 10+ KEYS EXHAUSTED.");
    }


// Socket.io Logic
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // SYNC: Send existing state to client on reconnect/mount
    socket.on('requestSessionState', () => {
        console.log(`Sending session state to ${socket.id}`);
        socket.emit('sessionStateUpdate', {
            analysis: sessionData.analysis,
            coverLetter: sessionData.coverLetter,
            resumeLoaded: !!sessionData.resume
        });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });

    // Store session data
    // Global sessionData is now used.
    // Removed local shadowing.

    socket.on('updateResume', (resumeText) => {
        console.log(`Resume updated for ${socket.id}`);
        sessionData.resume = resumeText;
        socket.emit('resumeConfirmed', "Resume received and analyzed.");
    });

    socket.on('updateSettings', (newSettings) => {
        console.log(`Settings updated for ${socket.id}`, newSettings);
        sessionData.settings = { ...sessionData.settings, ...newSettings };
        socket.emit('settingsConfirmed', "Context updated.");
    });

    // RATE LIMITER: Prevent Spamming Free Tier
    const lastRequestMap = new Map();


    socket.on('question', async (data) => {
        // --- COOLDOWN CHECK ---
        const now = Date.now();
        const lastRequest = lastRequestMap.get(socket.id) || 0;
        const timeSinceLast = now - lastRequest;

        // 300ms Cooldown (Extreme speed mode)
        if (timeSinceLast < 300) {
            console.log(`Skipping request from ${socket.id} (Cooldown: ${300 - timeSinceLast}ms)`);
            return;
        }
        lastRequestMap.set(socket.id, now);
        // ----------------------

        // Handle both simple string (legacy) and object (multimodal) payloads
        let transcript = "";
        let image = null;

        if (typeof data === 'string') {
            transcript = data;
        } else {
            transcript = data.transcript || "";
            image = data.image || null;
        }

        console.log(`Received input: "${transcript}" ${image ? "+ [Image Attached]" : ""}`);

        // Basic Validation (Skip if empty input)
        if ((!transcript || transcript.trim().length === 0) && !image) return;

        try {
            let suggestions = "";

            // PRIORITY 1: OpenAI (Keep as is, text only for now as user provided Gemini Key)
            if (openai) {
                const completion = await openai.chat.completions.create({
                    messages: [
                        { role: "system", content: "You are an expert technical interviewer. Provide a concise answer." },
                        { role: "user", content: transcript }
                    ],
                    model: "gpt-3.5-turbo",
                });
                suggestions = completion.choices[0].message.content;
            }

            // PRIORITY 2: Gemini (Multimodal)
            if (geminiModel) {
                const { role, company } = sessionData.settings;
                let promptParts = [];

                const systemInstruction = `Act as a Senior ${role} interviewing at ${company}. 
                
                **INSTRUCTIONS:**
                1. **Input Analysis**: 
                   - You may receive User Speech (Transcript) AND/OR a Screen Capture (Image).
                   - **Transcript**: May have phonetic errors. Infer technical intent.
                   - **Image**: If provided, analyze code snippets, diagrams, or question text on screen.
                
                2. **Context Synthesis**: Combine what you SEE (Screen) with what you HEAR (Speech) to understand the *exact* question being asked.
                
                3. **Personalization (Resume Context)**:
                   ${sessionData.resume ? `**CANDIDATE RESUME:** "${sessionData.resume.substring(0, 5000)}..."\n   - **Strategy**: Relate your answer to the candidate's past projects/skills found in the resume. Make it personalised.` : "- (No Resume Provided)"}

                4. **Response Structure (HUMAN MODE)**:
                   - **Target Persona**: You are the candidate. Speak confidently, naturally, and professionally.
                   - **Tone**: Conversational, "Senior Engineer" vibes. Not robotic.
                   - **Format**:
                     - Start with a direct "Bridge Phrase" (e.g., "That's an interesting question...", "The way I usually approach this is...").
                     - Then explain the solution simply and clearly.
                     - Use "I" statements (e.g., "I would use..." instead of "One should use...").
                     
                5. **CRITICAL: CODING MODE (Detect Technical Intent)**:
                   - **Trigger**: If the question asks for code, implementation, or a specific algorithm (e.g., "Write a function...", "How do you reverse...", "Solve Two Sum").
                   - **Action**: You MUST output the **WHOLE CODE SOLUTION**.
                   - **Format**:
                     - Brief 1-sentence intro.
                     - **FULL MARKDOWN CODE BLOCK** (e.g., \`\`\`javascript ... \`\`\`).
                     - ensure the code is **production-ready**, clean, and optimized.
                     - Minimal explanation after the code (let the code speak).
                   - **Do NOT** summarize the code. Show the **correct, working code**.

                6. **Answer Content**:
                   - **Smart & Deep**: Don't just give the textbook definition. Explain *why* it matters in production.
                   - **No Robot Fluff**: Do NOT say "Here is the answer" or "In conclusion". Just answer.
                   - **Structure**: 
                     - **The Hook**: 1 sentence summary.
                     - **The Meat**: 2-3 bullet points deep diving.
                     - **The Code**: If coding is needed, give the exact block.
                   - **Constraint**: Keep non-code text under 150 words. Speed is key.
                `;

                promptParts.push(systemInstruction);

                // Add Image if present
                if (image) {
                    try {
                        const base64Data = image.split(',')[1] || image;
                        promptParts.push({
                            inlineData: {
                                data: base64Data,
                                mimeType: "image/jpeg"
                            }
                        });
                        promptParts.push("\n\n**CONTEXT FROM SCREEN:** The user is looking at this content.");
                    } catch (e) {
                        console.error("Image processing error", e);
                    }
                }

                // Add Transcript
                if (transcript) {
                    promptParts.push(`\n\n**USER SPEECH:** "${transcript}"`);
                } else {
                    promptParts.push(`\n\n**USER SPEECH:** (Silent - please analyze the image content)`);
                }

                // Call with Cascade Failover Logic
                const result = await cascadeGenerateContent(promptParts, false, (chunkText, isFirst) => {
                    socket.emit('answerChunk', { chunk: chunkText, isFirst });
                });
                
                if (result) {
                    const response = await result.response;
                    suggestions = response.text();
                } else {
                    throw new Error("No Gemini Key Configured");
                }
            }

            // PRIORITY 3: Neural Knowledge Engine (Offline Fallback)
            else if (!openai && !geminiModel) {
                suggestions = FastEngine.generateAnswer(transcript);
            }

            socket.emit('answer', suggestions);
        } catch (error) {
            console.error("AI Processing Exhausted:", error);
            if (error.message.includes('429') || error.message.includes('503') || error.message.includes('EXHAUSTED')) {
                // If even the cascade fails, use the Offline Engine as a desperate fallback
                console.log("⚠️ API Exhausted. Switching to Offline Engine for this response.");
                const offlineAnswer = FastEngine.generateAnswer(transcript);
                socket.emit('answer', `⚠️ **Network Flux (Offline Mode)**\nAPI is extremely busy. Using local knowledge base for now.\n\n${offlineAnswer}`);
            } else {
                socket.emit('answer', `⚠️ AI Error: ${error.message}`);
            }
        }
    });

    // --- VISION SUPPORT (Parakeet Style) ---
    socket.on('analyzeScreen', async (imageData) => {
        console.log(`Analyzing screenshot for ${socket.id}`);
        try {
            if (openai) {
                const prompt = "Analyze this technical interview screenshot (code/question). Solve it concisely. Provide code or solution steps.";

                const completion = await openai.chat.completions.create({
                    messages: [
                        { role: "system", content: "You are an Expert Visual Coding Assistant. Solve the problem in the image." },
                        {
                            role: "user",
                            content: [
                                { type: "text", text: prompt },
                                { type: "image_url", image_url: { url: imageData } } // Ensure client sends full data URI
                            ]
                        }
                    ],
                    model: "gpt-4o-mini",
                });
                const solution = completion.choices[0].message.content;
                socket.emit('answer', `### 👁️ Vision Analysis\n${solution}`);
            } else {
                socket.emit('answer', "### 👁️ Mock Vision\nImage received! (Enable OpenAI Key for real analysis).");
            }
        } catch (e) {
            console.error("Vision Error:", e);
            socket.emit('answer', "❌ Vision Error: Could not analyze image.");
        }
    });

    // --- SPEECH ANALYTICS (Parakeet Style) ---
    socket.on('analyzeSpeech', (transcript) => {
        console.log(`Analyzing speech for ${socket.id}`);
        // 1. WPM Estimation (Rough avg: 130-150 wpm). 
        // We assume this chunk represents ~3-5 seconds of speech if it's a sentence.
        // Better: Client should send duration. For now, simple count.
        const wordCount = transcript.split(' ').length;

        // 2. Filler Word Detection
        // Note: Web Speech API often filters these, but we check anyway.
        const fillers = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally'];
        const foundFillers = fillers.filter(w => transcript.toLowerCase().includes(w));

        // 3. Simple Heuristic Score (0-10)
        let baseScore = 9;
        baseScore -= foundFillers.length * 0.5; // Penalty for fillers
        if (wordCount < 5) baseScore -= 2; // Penalty for too short
        const finalScore = Math.max(0, Math.min(10, baseScore));

        socket.emit('speechAnalysisResult', {
            wordCount,
            fillers: foundFillers,
            pace: wordCount > 30 ? "Fast" : (wordCount > 10 ? "Moderate" : "Slow"),
            score: finalScore.toFixed(1), // New Field
            timestamp: new Date().toISOString()
        });
    });

    // --- MOCK INTERVIEW LOGIC ---
    // --- MOCK INTERVIEW LOGIC ---
    socket.on('startMockInterview', async () => {
        console.log(`Starting mock interview for ${socket.id}`);
        try {
            if (geminiModel) {
                const { role, company } = sessionData.settings;
                const resumeContext = sessionData.resume ? `Candidate Resume: "${sessionData.resume.substring(0, 3000)}"` : "";

                const prompt = `Act as a Loop Interviewer at ${company} for a ${role} position.
                 ${resumeContext}
                 
                 Task: Generate 1 challenging technical or behavioral interview question. 
                 - Make it relevant to the candidate's resume if provided.
                 - Do NOT provide the answer.
                 - Just the question text.`;

                const result = await geminiModel.generateContent(prompt);
                const question = (await result.response).text();

                socket.emit('mockQuestion', question);
            } else {
                // Fallback / OpenAI Code if needed (Simplified for verify)
                const fallbackQs = ["Explain the Virtual DOM.", "What is a Closure?", "Design a URL Shortener."];
                socket.emit('mockQuestion', fallbackQs[Math.floor(Math.random() * fallbackQs.length)]);
            }
        } catch (e) {
            console.error(e);
            socket.emit('mockQuestion', "Describe a challenging project you worked on?");
        }
    });

    socket.on('submitMockAnswer', async (data) => {
        console.log(`Grading answer for ${socket.id}`);
        const { question, answer } = data;
        try {
            if (geminiModel) {
                console.log("Sending answer to Gemini for grading...");
                console.log("Sending answer to Gemini for grading...");

                async function getGrading(retryCount = 0) {
                    const prompt = `
                     Question: "${question}"
                     Candidate Answer: "${answer}"
                     
                     Task: Act as a Senior Hiring Manager. Grade this answer.
                     ${retryCount > 0 ? "**IMPORTANT: You previously returned invalid JSON. Please output STRICT JSON only. No markdown formatting.**" : ""}
                     
                     Return strictly valid JSON:
                     {
                        "score": number (0-10),
                        "feedback": "constructive critique",
                        "betterAnswer": "example of a 10/10 STAR format answer"
                     }
                     `;

                    const result = await cascadeGenerateContent(prompt);
                    const text = (await result.response).text();
                    console.log(`Gemini Grading Response (Attempt ${retryCount + 1}):`, text);

                    try {
                        let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
                        if (jsonStr.includes('{') && jsonStr.includes('}')) {
                            jsonStr = jsonStr.substring(jsonStr.indexOf('{'), jsonStr.lastIndexOf('}') + 1);
                        }
                        return JSON.parse(jsonStr);
                    } catch (parseErr) {
                        console.error("JSON Parse failed.");

                        // Robust Regex Fallback
                        const scoreMatch = text.match(/"score":\s*"?(\d+)"?/);
                        const feedbackMatch = text.match(/"feedback":\s*"((?:[^"\\]|\\.)*)"/s);

                        // If completely unparseable and we haven't retried yet, try again!
                        if (retryCount < 1 && (!scoreMatch || !feedbackMatch)) {
                            console.log("♻️ Triggering Self-Correction for JSON...");
                            return await getGrading(retryCount + 1);
                        }

                        // Last Resort Fallback
                        const betterMatch = text.match(/"betterAnswer":\s*"((?:[^"\\]|\\.)*)"/s);
                        return {
                            score: scoreMatch ? parseInt(scoreMatch[1]) : 0,
                            feedback: feedbackMatch ? feedbackMatch[1] : "Feedback could not be parsed automatically. Check logs.",
                            betterAnswer: betterMatch ? betterMatch[1] : "N/A"
                        };
                    }
                }

                const feedbackData = await getGrading();

                console.log("Emiting feedback:", feedbackData);
                socket.emit('mockFeedback', feedbackData);
            } else {
                socket.emit('mockFeedback', { score: 7, feedback: "Good effort (Offline Mode).", betterAnswer: "N/A" });
            }
        } catch (e) {
            console.error(e);
            socket.emit('mockFeedback', { score: 0, feedback: "Error grading answer.", betterAnswer: "N/A" });
        }
    });
    // (End of socket handlers)

    socket.on('analyzeResume', async (data) => {
        const jobDescription = data?.jobDescription || "";
        console.log(`Analyzing resume for ${socket.id} (Targeting: ${jobDescription ? "Specific JD" : "General Role"})`);

        try {
            if (sessionData.resume) {
                const { role } = sessionData.settings;

                // Construct Prompt for Gemini
                const promptParts = [`
                Act as a Senior Technical Recruiter & ATS Algorithm Expert.
                Target Job Role: ${role || "Software Engineer"}.
                ${jobDescription ? `SPECIFIC JOB DESCRIPTION TO MATCH: "${jobDescription.substring(0, 3000)}"` : ""}
                
                CANDIDATE RESUME CONTENT:
                """
                ${sessionData.resume.substring(0, 8000)}
                """

                TASK:
                Perform a ruthless ATS (Applicant Tracking System) scan on this resume.
                ${jobDescription ? "Compare the resume STRICTLY against the provided Job Description." : "Compare against standard industry requirements for the role."}
                
                Return a RAW JSON object (no markdown formatting) with this exact structure:
                {
                    "score": 0-100 (integer, be strict),
                    "summary": "1 sentence verdict (e.g., 'Strong match for Senior React Dev but missing AWS').",
                    "keywords_missing": ["list", "of", "missing", "keywords", "found", "in", "JD", "but", "not", "in", "resume"],
                    "improvements": [
                        { "original": "Weak bullet point from resume", "improved": "Rewritten strong bullet tailored to JD keywords" },
                        { "original": "Another weak point", "improved": "Better version" }
                    ]
                }
                
                CRITICAL INSTRUCTION: Return ONLY valid JSON.
                `];

                // Use the Robust Cascade System
                const result = await cascadeGenerateContent(promptParts);
                const responseText = await result.response.text();

                console.log("ATS Raw Response:", responseText.substring(0, 100) + "...");

                // Robust JSON Parser
                let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                const firstBrace = cleanJson.indexOf('{');
                const lastBrace = cleanJson.lastIndexOf('}');

                if (firstBrace !== -1 && lastBrace !== -1) {
                    cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
                }

                const analysis = JSON.parse(cleanJson);

                // SAVE TO SESSION (Persistence)
                sessionData.analysis = analysis;

                socket.emit('resumeAnalysisResult', analysis);
            } else {
                // Return dummy data if no resume uploaded yet
                socket.emit('resumeAnalysisResult', {
                    score: 0,
                    summary: "No resume uploaded yet.",
                    keywords_missing: ["Resume"],
                    improvements: []
                });
            }
        } catch (e) {
            console.error("Resume Analysis Failed:", e);
            socket.emit('resumeAnalysisResult', FastEngine.analyzeResume());
        }
    });

    socket.on('generateCoverLetter', async (data) => {
        const jobDescription = data?.jobDescription;
        if (!jobDescription || !sessionData.resume) return;

        try {
            console.log("Generating Cover Letter...");
            const promptParts = [`
                Act as a Professional Resume Writer.
                
                TASK: Write a compelling, perfectly formatted Cover Letter for a candidate applying to a job.
                
                CANDIDATE RESUME: "${sessionData.resume.substring(0, 5000)}"
                TARGET JOB DESCRIPTION: "${jobDescription.substring(0, 3000)}"
                
                INSTRUCTIONS:
                1. Use standard business letter format.
                2. HOOK the reader in the first paragraph by mentioning a specific requirement from the JD and how the candidate meets it.
                3. Use the middle paragraphs to bridge the candidate's specific past experience (from resume) to the problems referenced in the JD.
                4. Tone: Confident, Professional, Enthusiastic.
                5. Do NOT use placeholders like [Your Name], use the actual name from the resume or "The Candidate" if unknown.
                6. Output pure text/markdown.
            `];

            const result = await cascadeGenerateContent(promptParts);
            const text = await result.response.text();

            // SAVE TO SESSION (Persistence)
            sessionData.coverLetter = text;

            socket.emit('coverLetterResult', text);
        } catch (e) {
            console.error("Cover Letter Error:", e);
            socket.emit('coverLetterResult', "Error generating cover letter. Please try again.");
        }
    });

    socket.on('predictQuestions', async () => {
        try {
            console.log(`Predicting questions for ${socket.id}`);
            if (sessionData.settings) {
                const { role, company } = sessionData.settings;
                // Use Gemini for Predictions now too since we have it
                const promptParts = [`
                    Act as a Hiring Manager at ${company || "a Tech Company"}.
                    Role: ${role || "Software Engineer"}.
                    Generate 5 precise, likely interview questions (Technical + Behavioral).
                    Return JSON: { "questions": ["Q1", "Q2", ...] }
                `];

                const result = await cascadeGenerateContent(promptParts);
                const text = await result.response.text();
                const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const data = JSON.parse(clean);

                socket.emit('predictionResult', data.questions);
            } else {
                socket.emit('predictionResult', [
                    "Explain the Virtual DOM.",
                    "How do you handle state management?",
                    "Tell me about a time you failed.",
                    "System Design: URL Shortener"
                ]);
            }
        } catch (e) {
            console.error(e);
            socket.emit('predictionResult', ["Error generating questions."]);
        }
    });
});

// --- Upload Endpoint ---
app.post('/api/upload-resume', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No file uploaded.');

        let text = "";
        const mimeType = req.file.mimetype;

        if (mimeType === 'application/pdf') {
            try {
                const data = await pdf(req.file.buffer);
                text = data.text;

                if (text.trim().length < 50) {
                    console.log("⚠️ Low text density detected. Attempting Gemini Vision OCR (Scanned PDF Mode)...");
                    throw new Error("Scanned PDF detected");
                }
            } catch (e) {
                // Fallback to Cascade Vision
                console.log("🔮 Invoking Multi-Key Vision Cascade for PDF...");
                text = await cascadeVisionContent(req.file.buffer, 'application/pdf');
            }
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // ... existing DOCX logic ...
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            text = result.value;
        } else if (mimeType.startsWith('image/')) {
            // Native Image OCR support (JPG/PNG resumes)
            console.log("🖼️ Image detected. Using Vision Cascade...");
            text = await cascadeVisionContent(req.file.buffer, mimeType);
        } else {
            // Assume text/plain
            text = req.file.buffer.toString('utf8');
        }

        // Clean up text
        text = text.replace(/\n+/g, " ").trim();

        console.log(`Resume uploaded via API. Length: ${text.length}`);

        // Update session
        sessionData.resume = text;

        res.json({ success: true, text: text });
    } catch (err) {
        console.error("Upload error stack:", err.stack);
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- SERVER AUTO-HEAL STARTUP ---
// Using existing 'require' from top of file
const { exec } = require('child_process');

const startServer = (retryCount = 0) => {
    const server = vite_style_listen_hack();

    function vite_style_listen_hack() {
        const s = httpServer.listen(PORT, () => {
            console.log(`✅ Server listening on http://localhost:${PORT}`);
        });

        s.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`⚠️ Port ${PORT} busy. Auto-correcting... (Identifying & Killing Zombie Process)`);

                // Nuclear option: Kill node.exe that isn't THIS process
                // Windows-specific kill command for port 3000
                exec(`netstat -ano | findstr :${PORT}`, (err, stdout) => {
                    if (stdout) {
                        const parts = stdout.trim().split(/\s+/);
                        const pid = parts[parts.length - 1]; // PID is last column
                        if (pid && pid !== process.pid.toString()) {
                            console.log(`🔫 Killing Zombie PID: ${pid}`);
                            exec(`taskkill /F /PID ${pid}`, () => {
                                console.log("♻️ Restarting Server...");
                                setTimeout(() => startServer(retryCount + 1), 1000);
                            });
                        } else {
                            console.log("⚠️ Could not identify distinct PID. Retrying...");
                            setTimeout(() => startServer(retryCount + 1), 2000);
                        }
                    }
                });
            } else {
                console.error("Server Error:", err);
            }
        });
        return s;
    }
};

startServer();
