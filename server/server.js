import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import mammoth from 'mammoth';
import { createRequire } from "module";
import crypto from 'crypto';
import { AIEngine, FastEngine, classifyError, getOpaqueKeyLabel, validateGeminiCredentialFormat, validateOpenAICredentialFormat, logProviderAttempt } from './ai_engine.js';

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

dotenv.config();

// =============================================================================
// CONFIGURATION & VALIDATION
// =============================================================================

const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

const DEFAULT_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
    'https://interview-copilot-aii.vercel.app'
];

const ALL_ORIGINS = [...new Set([...DEFAULT_ORIGINS, ...ALLOWED_ORIGINS])];

// --- Environment Variable Validation ---
function validateConfig() {
    const openaiKey = process.env.OPENAI_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    const openaiValidation = validateOpenAICredentialFormat(openaiKey);
    const geminiValidation = validateGeminiCredentialFormat(geminiKey);

    let validNumberedKeys = 0;
    let unsupportedNumberedKeys = 0;
    for (let i = 1; i <= 20; i++) {
        const k = process.env[`GEMINI_API_KEY_${i}`];
        if (k) {
            const v = validateGeminiCredentialFormat(k);
            if (v.valid) validNumberedKeys++;
            else if (v.status === 'INVALID_FORMAT_OAUTH_TOKEN') unsupportedNumberedKeys++;
        }
    }

    console.log('┌──────────────────────────────────────────────┐');
    console.log('│     Interview Copilot AI — Boot Check        │');
    console.log('├──────────────────────────────────────────────┤');
    console.log(`│ OpenAI Format:          ${openaiValidation.valid ? '✅ Valid (unverified)' : '⬚  Not configured'}     │`);
    console.log(`│ Gemini Format:          ${geminiValidation.valid ? '✅ Valid (unverified)' : (geminiValidation.status === 'INVALID_FORMAT_OAUTH_TOKEN' ? '⚠️  AQ. (OAuth token)' : '⬚  Not configured')}   │`);
    console.log(`│ Gemini Extra Keys:      ${validNumberedKeys > 0 ? `✅ ${validNumberedKeys} valid key(s)` : '⬚  None'}            │`);
    console.log(`│ CORS Allowed Origins:   ${ALL_ORIGINS.length} domain(s)            │`);
    console.log('└──────────────────────────────────────────────┘');

    if (geminiValidation.status === 'INVALID_FORMAT_OAUTH_TOKEN' || unsupportedNumberedKeys > 0) {
        console.warn('⚠️  CREDENTIAL FORMAT WARNING:');
        console.warn('   Configured Gemini keys start with "AQ." (OAuth/Vertex tokens).');
        console.warn('   The @google/generative-ai SDK requires Google AI Studio API keys (starts with "AIzaSy...").');
        console.warn('   Get a free Google AI Studio API key at: https://aistudio.google.com/app/apikey');
    }

    if (!openaiValidation.valid && !geminiValidation.valid && validNumberedKeys === 0) {
        console.warn('ℹ️  INFO: No valid AI provider keys configured. Operating in Offline Knowledge Engine mode.');
        console.warn('   Copy server/.env.example to server/.env and provide valid keys for live AI generation.');
    }

    return { openaiValidation, geminiValidation, validNumberedKeys, unsupportedNumberedKeys };
}

const config = validateConfig();

// --- Dynamic Gemini Key Pool ---
const GEMINI_KEYS = [];
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10 && !process.env.GEMINI_API_KEY.includes('your_')) {
    GEMINI_KEYS.push(process.env.GEMINI_API_KEY);
}
if (process.env.GEMINI_API_KEY_SECONDARY && process.env.GEMINI_API_KEY_SECONDARY.length > 10) {
    GEMINI_KEYS.push(process.env.GEMINI_API_KEY_SECONDARY);
}
for (let i = 1; i <= 20; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key && key.length > 10 && !key.includes('your_')) GEMINI_KEYS.push(key);
}
const UNIQUE_KEYS = [...new Set(GEMINI_KEYS)];

// Instantiate Unified AI Engine
export const aiEngine = new AIEngine({
    openAIKey: process.env.OPENAI_KEY,
    geminiKeys: UNIQUE_KEYS
});

// =============================================================================
// EXPRESS APP SETUP
// =============================================================================

const app = express();

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (ALL_ORIGINS.includes(origin)) return callback(null, true);
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('CORS policy violation'));
    },
    methods: ['GET', 'POST'],
    credentials: false
}));

app.use(express.json({ limit: '1mb' }));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'image/jpeg',
            'image/png',
            'image/webp'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}`));
        }
    }
});

const httpServer = createServer(app);

// =============================================================================
// SOCKET.IO SETUP
// =============================================================================

const io = new Server(httpServer, {
    cors: {
        origin: ALL_ORIGINS,
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 5 * 1024 * 1024,
    pingTimeout: 60000,
    pingInterval: 25000
});

// =============================================================================
// PER-SOCKET SESSION DATA
// =============================================================================

const sessions = new Map();

function getSession(socketId) {
    if (!sessions.has(socketId)) {
        sessions.set(socketId, {
            resume: "",
            analysis: null,
            coverLetter: "",
            context: [],
            settings: {
                role: "Software Engineer",
                company: "General Tech",
                tone: "Professional",
                detailLevel: "Concise"
            }
        });
    }
    return sessions.get(socketId);
}

function destroySession(socketId) {
    sessions.delete(socketId);
}

// =============================================================================
// BOUNDED MULTI-OPERATION RATE LIMITER (IP-AWARE & IN-MEMORY)
// =============================================================================
// Note on architecture: This in-memory rate limiter tracks by client IP address
// (from socket handshake or HTTP headers) to prevent trivial bypass via disconnect/reconnect.
// Limitation in horizontally-scaled multi-instance deployments: In-memory state is local
// to each Node.js process. Production multi-instance clusters would require a shared
// Redis store (or Cloud Memorystore) to enforce global cross-pod rate limits.

const ipRateLimits = new Map(); // ip -> { lastRequests: Map(op -> timestamp) }
const socketConcurrentMap = new Map(); // socketId -> Map(op -> count)

const OPERATION_LIMITS = {
    question: { cooldownMs: 1500, maxConcurrent: 1 },
    analyzeScreen: { cooldownMs: 2000, maxConcurrent: 1 },
    startMockInterview: { cooldownMs: 3000, maxConcurrent: 1 },
    submitMockAnswer: { cooldownMs: 2000, maxConcurrent: 1 },
    analyzeResume: { cooldownMs: 4000, maxConcurrent: 1 },
    generateCoverLetter: { cooldownMs: 5000, maxConcurrent: 1 },
    predictQuestions: { cooldownMs: 4000, maxConcurrent: 1 }
};

function getClientIp(socketOrReq) {
    if (socketOrReq.handshake) {
        const forwarded = socketOrReq.handshake.headers?.['x-forwarded-for'];
        if (forwarded) return forwarded.split(',')[0].trim();
        return socketOrReq.handshake.address || '127.0.0.1';
    }
    const forwarded = socketOrReq.headers?.['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return socketOrReq.ip || socketOrReq.socket?.remoteAddress || '127.0.0.1';
}

function checkRateLimit(socket, operation) {
    const limits = OPERATION_LIMITS[operation] || { cooldownMs: 1500, maxConcurrent: 1 };
    const ip = getClientIp(socket);
    const now = Date.now();

    let ipState = ipRateLimits.get(ip);
    if (!ipState) {
        ipState = { lastRequests: new Map() };
        ipRateLimits.set(ip, ipState);
    }

    const lastTime = ipState.lastRequests.get(operation) || 0;
    const elapsed = now - lastTime;
    if (elapsed < limits.cooldownMs) {
        const remainingMs = limits.cooldownMs - elapsed;
        return {
            allowed: false,
            reason: 'cooldown',
            remainingMs,
            message: `Rate limit active. Please wait ${(remainingMs / 1000).toFixed(1)}s before triggering ${operation}.`
        };
    }

    let socketConcurrent = socketConcurrentMap.get(socket.id);
    if (!socketConcurrent) {
        socketConcurrent = new Map();
        socketConcurrentMap.set(socket.id, socketConcurrent);
    }

    const currentConcurrent = socketConcurrent.get(operation) || 0;
    if (currentConcurrent >= limits.maxConcurrent) {
        return {
            allowed: false,
            reason: 'concurrent',
            remainingMs: 0,
            message: `A request for ${operation} is already processing for this session.`
        };
    }

    ipState.lastRequests.set(operation, now);
    socketConcurrent.set(operation, currentConcurrent + 1);
    return { allowed: true };
}

function releaseRateLimit(socketId, operation) {
    const socketConcurrent = socketConcurrentMap.get(socketId);
    if (socketConcurrent) {
        const cur = socketConcurrent.get(operation) || 0;
        if (cur > 0) socketConcurrent.set(operation, cur - 1);
    }
}

function cleanupSocketLimits(socketId) {
    socketConcurrentMap.delete(socketId);
}

// In-memory HTTP Upload Rate Limiting (10 uploads per 60 seconds per IP)
const httpUploadLimits = new Map();
function checkHttpUploadRateLimit(req) {
    const ip = getClientIp(req);
    const now = Date.now();
    let entry = httpUploadLimits.get(ip);
    if (!entry || now > entry.resetTime) {
        entry = { count: 1, resetTime: now + 60000 };
        httpUploadLimits.set(ip, entry);
        return { allowed: true };
    }
    if (entry.count >= 10) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
        return { allowed: false, retryAfter };
    }
    entry.count++;
    return { allowed: true };
}

// Periodic cleanup every 5 minutes to prevent memory leak
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of httpUploadLimits.entries()) {
        if (now > entry.resetTime) httpUploadLimits.delete(ip);
    }
    for (const [ip, state] of ipRateLimits.entries()) {
        let allExpired = true;
        for (const [, ts] of state.lastRequests.entries()) {
            if (now - ts < 60000) { allExpired = false; break; }
        }
        if (allExpired) ipRateLimits.delete(ip);
    }
}, 5 * 60 * 1000).unref();

// =============================================================================
// HEALTH & READINESS ENDPOINTS
// =============================================================================

app.get('/', (req, res) => {
    res.send('Interview Copilot AI Server is running.');
});

app.get('/health', (req, res) => {
    const health = aiEngine.getProviderHealth();
    res.json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        providers: {
            openai: {
                configured: health.openai.configured,
                formatValid: health.openai.formatValid,
                liveVerified: health.openai.liveVerified,
                status: health.openai.status
            },
            gemini: {
                configured: health.gemini.configured,
                formatValid: health.gemini.formatValid,
                keysConfigured: health.gemini.keysConfigured,
                keysFormatValid: health.gemini.keysFormatValid,
                keysActive: health.gemini.keysActive,
                liveVerified: health.gemini.liveVerified,
                status: health.gemini.status
            },
            liveAIReady: health.liveAIReady,
            activeTier: health.activeTier,
            offlineAvailable: health.offlineAvailable
        },
        connections: io.engine?.clientsCount || 0
    });
});

app.get('/health/ready', (req, res) => {
    const health = aiEngine.getProviderHealth();
    if (health.liveAIReady) {
        res.status(200).json({
            ready: true,
            status: 'LIVE_READY',
            message: 'Live AI provider is verified and ready'
        });
    } else if (health.gemini.formatValid || health.openai.formatValid) {
        res.status(503).json({
            ready: false,
            status: 'FORMAT_VALID_UNVERIFIED',
            message: 'AI provider is configured with valid credential format, but live network availability has not yet been verified'
        });
    } else {
        res.status(503).json({
            ready: false,
            status: 'NOT_CONFIGURED',
            message: 'No live AI providers configured — operating in offline mode'
        });
    }
});

// =============================================================================
// SOCKET.IO CONNECTION HANDLER
// =============================================================================

io.on('connection', (socket) => {
    console.log(`🔗 Connected: ${socket.id}`);
    const session = getSession(socket.id);

    // Initial state sync with settings isolation
    socket.on('requestSessionState', () => {
        socket.emit('sessionStateUpdate', {
            analysis: session.analysis,
            coverLetter: session.coverLetter,
            resumeLoaded: !!session.resume,
            settings: {
                role: session.settings.role,
                company: session.settings.company,
                tone: session.settings.tone,
                detailLevel: session.settings.detailLevel
            }
        });
    });

    // Report provider status truthfully
    const health = aiEngine.getProviderHealth();
    socket.emit('providerStatus', {
        hasOpenAI: health.openai.liveVerified,
        hasGemini: health.gemini.liveVerified,
        isOnline: health.liveAIReady,
        activeKeys: health.gemini.keysActive,
        geminiStatus: health.gemini.status,
        openaiStatus: health.openai.status,
        configured: {
            openai: health.openai.configured,
            gemini: health.gemini.configured
        },
        formatValid: {
            openai: health.openai.formatValid,
            gemini: health.gemini.formatValid
        },
        liveVerified: {
            openai: health.openai.liveVerified,
            gemini: health.gemini.liveVerified
        }
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Disconnected: ${socket.id}`);
        destroySession(socket.id);
        cleanupSocketLimits(socket.id);
    });

    socket.on('updateResume', (resumeText) => {
        if (typeof resumeText !== 'string' || resumeText.length > 50000) {
            socket.emit('error', 'Resume text too long (max 50,000 characters)');
            return;
        }
        session.resume = resumeText;
        socket.emit('resumeConfirmed', "Resume received and analyzed.");
    });

    socket.on('updateSettings', (newSettings) => {
        if (typeof newSettings !== 'object' || newSettings === null) return;
        const allowed = ['role', 'company', 'tone', 'detailLevel'];
        for (const key of allowed) {
            if (typeof newSettings[key] === 'string' && newSettings[key].length <= 200) {
                session.settings[key] = newSettings[key];
            }
        }
        socket.emit('settingsConfirmed', "Context updated.");
    });

    // MAIN QUESTION HANDLER
    socket.on('question', async (data) => {
        const requestId = crypto.randomBytes(4).toString('hex');

        const rateCheck = checkRateLimit(socket, 'question');
        if (!rateCheck.allowed) {
            console.log(`[${requestId}] ⏳ Rate limited (${rateCheck.reason}): ${socket.id}`);
            socket.emit('rateLimited', { reason: rateCheck.reason, message: rateCheck.message });
            return;
        }

        try {
            let transcript = "";
            let image = null;
            if (typeof data === 'string') {
                transcript = data;
            } else if (typeof data === 'object' && data !== null) {
                transcript = typeof data.transcript === 'string' ? data.transcript : "";
                image = typeof data.image === 'string' ? data.image : null;
            }

            if (transcript.trim().length === 0 && !image) return;
            if (transcript.length > 5000) transcript = transcript.substring(0, 5000);

            console.log(`[${requestId}] 📥 Question: [${transcript.length} chars] ${image ? '+ [Image payload]' : ''}`);

            socket.emit('answerChunk', { chunk: "🔄 *Analyzing question...*\n\n", isFirst: true });

            const result = await aiEngine.generateAnswer(
                transcript, image, session, requestId,
                (chunkText, isFirst) => {
                    socket.emit('answerChunk', { chunk: chunkText, isFirst });
                }
            );

            if (result.isOffline) {
                socket.emit('answer', `📴 **Offline Mode**\nNo AI provider is currently available. Using built-in knowledge base.\n\n${result.text}`);
            } else {
                socket.emit('answer', result.text);
            }

        } catch (error) {
            console.error(`[${requestId}] ❌ AI Error:`, error.message);
            const transcript_fallback = typeof data === 'string' ? data : data?.transcript || '';
            const offlineAnswer = FastEngine.generateAnswer(transcript_fallback);
            socket.emit('answer', `📴 **Offline Mode**\nAI providers temporarily unavailable. Using built-in knowledge base.\n\n${offlineAnswer}`);
        } finally {
            releaseRateLimit(socket.id, 'question');
        }
    });

    // VISION SUPPORT
    socket.on('analyzeScreen', async (imageData) => {
        const requestId = crypto.randomBytes(4).toString('hex');

        if (typeof imageData !== 'string' || imageData.length > 5 * 1024 * 1024) {
            socket.emit('answer', '❌ Image too large or invalid format (max 5MB base64 string).');
            return;
        }

        const rateCheck = checkRateLimit(socket, 'analyzeScreen');
        if (!rateCheck.allowed) {
            socket.emit('rateLimited', { reason: rateCheck.reason, message: rateCheck.message });
            socket.emit('answer', `⏳ Screen analysis rate limit active. Please wait a moment.`);
            return;
        }

        console.log(`[${requestId}] 👁️ Screen analysis [${imageData.length} bytes] for ${socket.id}`);

        try {
            const base64Data = imageData.split(',')[1] || imageData;
            const result = await aiEngine.cascadeGemini([
                { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
                "Analyze this technical interview screenshot (code/question). Solve it concisely. Provide code or solution steps."
            ], { requestId });
            const responseText = (await result.response).text();
            socket.emit('answer', `### 👁️ Vision Analysis\n${responseText}`);
        } catch (e) {
            console.warn(`[${requestId}] Vision live analysis failed:`, e.message);
            socket.emit('answer', "### 👁️ Vision Analysis (Offline)\nCould not complete live vision analysis. Ensure a valid Gemini API key is configured.");
        } finally {
            releaseRateLimit(socket.id, 'analyzeScreen');
        }
    });

    // SPEECH ANALYTICS
    socket.on('analyzeSpeech', (transcript) => {
        if (typeof transcript !== 'string' || transcript.length > 5000) return;

        const wordCount = transcript.split(' ').length;
        const fillers = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally'];
        const foundFillers = fillers.filter(w => transcript.toLowerCase().includes(w));

        let baseScore = 9;
        baseScore -= foundFillers.length * 0.5;
        if (wordCount < 5) baseScore -= 2;
        const finalScore = Math.max(0, Math.min(10, baseScore));

        socket.emit('speechAnalysisResult', {
            wordCount,
            fillers: foundFillers,
            pace: wordCount > 30 ? "Fast" : (wordCount > 10 ? "Moderate" : "Slow"),
            score: finalScore.toFixed(1),
            timestamp: new Date().toISOString()
        });
    });

    // MOCK INTERVIEW
    socket.on('startMockInterview', async () => {
        const requestId = crypto.randomBytes(4).toString('hex');

        const rateCheck = checkRateLimit(socket, 'startMockInterview');
        if (!rateCheck.allowed) {
            socket.emit('rateLimited', { reason: rateCheck.reason, message: rateCheck.message });
            socket.emit('mockQuestion', "⏳ Please wait a moment before requesting another mock interview question.");
            return;
        }

        console.log(`[${requestId}] 🎙️ Mock interview request for ${socket.id}`);

        try {
            const { role, company } = session.settings;
            const resumeContext = session.resume ? `Candidate Resume: "${session.resume.substring(0, 3000)}"` : "";
            const prompt = `Act as a Loop Interviewer at ${company} for a ${role} position.
${resumeContext}
Task: Generate 1 challenging technical or behavioral interview question.
- Make it relevant to the candidate's resume if provided.
- Do NOT provide the answer.
- Just the question text.`;

            const result = await aiEngine.cascadeGemini([prompt], { requestId });
            const text = (await result.response).text();
            socket.emit('providerMeta', { operation: 'mockQuestion', tier: 'gemini_live' });
            socket.emit('mockQuestion', text);
        } catch (e) {
            console.warn(`[${requestId}] Mock interview live generation failed: ${e.message}. Serving from FastEngine.`);
            socket.emit('providerMeta', { operation: 'mockQuestion', tier: 'offline_fast_engine' });
            socket.emit('mockQuestion', FastEngine.generateMockQuestion());
        } finally {
            releaseRateLimit(socket.id, 'startMockInterview');
        }
    });

    socket.on('submitMockAnswer', async (data) => {
        const requestId = crypto.randomBytes(4).toString('hex');
        if (typeof data !== 'object' || !data?.question || !data?.answer) {
            socket.emit('mockFeedback', { score: 0, feedback: "Invalid submission.", betterAnswer: "N/A" });
            return;
        }

        const { question, answer } = data;
        if (typeof question !== 'string' || typeof answer !== 'string') return;
        if (question.length > 3000 || answer.length > 5000) {
            socket.emit('mockFeedback', { score: 0, feedback: "Payload exceeds maximum length limit.", betterAnswer: "N/A" });
            return;
        }

        const rateCheck = checkRateLimit(socket, 'submitMockAnswer');
        if (!rateCheck.allowed) {
            socket.emit('rateLimited', { reason: rateCheck.reason, message: rateCheck.message });
            socket.emit('mockFeedback', { score: 0, feedback: "Rate limit active. Please wait a moment before submitting again.", betterAnswer: "N/A" });
            return;
        }

        console.log(`[${requestId}] 📝 Grading answer for ${socket.id}`);

        try {
            const prompt = `
Question: "${question.substring(0, 2000)}"
Candidate Answer: "${answer.substring(0, 3000)}"

Task: Act as a Senior Hiring Manager. Grade this answer.
Return strictly valid JSON:
{
   "score": number (0-10),
   "feedback": "constructive critique",
   "betterAnswer": "example of a 10/10 STAR format answer"
}`;

            const result = await aiEngine.cascadeGemini([prompt], { requestId });
            const text = (await result.response).text();
            let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            if (jsonStr.includes('{') && jsonStr.includes('}')) {
                jsonStr = jsonStr.substring(jsonStr.indexOf('{'), jsonStr.lastIndexOf('}') + 1);
            }
            const feedback = JSON.parse(jsonStr);
            feedback.providerTier = 'gemini_live';
            socket.emit('mockFeedback', feedback);
        } catch (e) {
            console.warn(`[${requestId}] Live answer grading failed: ${e.message}. Using offline heuristic.`);
            socket.emit('mockFeedback', {
                score: 7,
                feedback: "Good effort (Offline heuristic mode). Frame your response with clear metrics and the STAR format.",
                betterAnswer: "Start with the context and your ownership, explain the specific technical decision, and conclude with measurable impact.",
                providerTier: 'offline_heuristic'
            });
        } finally {
            releaseRateLimit(socket.id, 'submitMockAnswer');
        }
    });

    // RESUME ANALYSIS
    socket.on('analyzeResume', async (data) => {
        const requestId = crypto.randomBytes(4).toString('hex');
        const jobDescription = (typeof data?.jobDescription === 'string') ? data.jobDescription.substring(0, 5000) : "";

        const rateCheck = checkRateLimit(socket, 'analyzeResume');
        if (!rateCheck.allowed) {
            socket.emit('rateLimited', { reason: rateCheck.reason, message: rateCheck.message });
            socket.emit('resumeAnalysisResult', {
                score: 0,
                summary: "Rate limit active. Please wait a moment before requesting another resume analysis.",
                keywords_missing: [],
                improvements: [],
                providerTier: 'rate_limited'
            });
            return;
        }

        console.log(`[${requestId}] 📊 Resume analysis for ${socket.id}`);

        try {
            if (!session.resume) {
                socket.emit('resumeAnalysisResult', {
                    score: 0,
                    summary: "No resume uploaded yet. Please upload your resume first.",
                    keywords_missing: ["Resume"],
                    improvements: [],
                    providerTier: 'no_resume'
                });
                return;
            }

            const { role } = session.settings;
            const promptParts = [`
Act as a Senior Technical Recruiter & ATS Algorithm Expert.
Target Job Role: ${role || "Software Engineer"}.
${jobDescription ? `SPECIFIC JOB DESCRIPTION TO MATCH: "${jobDescription.substring(0, 3000)}"` : ""}

CANDIDATE RESUME CONTENT:
"""
${session.resume.substring(0, 8000)}
"""

TASK:
Perform an ATS (Applicant Tracking System) scan on this resume.
Return a RAW JSON object with: score (0-100 integer), summary, keywords_missing (array), improvements (array of {original, improved}).
Return ONLY valid JSON.
`];

            const result = await aiEngine.cascadeGemini(promptParts, { requestId });
            const responseText = await (await result.response).text();
            let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const firstBrace = cleanJson.indexOf('{');
            const lastBrace = cleanJson.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
            }
            const analysis = JSON.parse(cleanJson);
            analysis.providerTier = 'gemini_live';
            session.analysis = analysis;
            socket.emit('resumeAnalysisResult', analysis);
        } catch (e) {
            console.warn(`[${requestId}] Live ATS analysis failed: ${e.message}. Serving FastEngine analysis.`);
            const fallbackAnalysis = FastEngine.analyzeResume();
            fallbackAnalysis.providerTier = 'offline_fast_engine';
            socket.emit('resumeAnalysisResult', fallbackAnalysis);
        } finally {
            releaseRateLimit(socket.id, 'analyzeResume');
        }
    });

    // COVER LETTER
    socket.on('generateCoverLetter', async (data) => {
        const requestId = crypto.randomBytes(4).toString('hex');
        const jobDescription = (typeof data?.jobDescription === 'string') ? data.jobDescription.substring(0, 5000) : null;

        if (!jobDescription || !session.resume) {
            socket.emit('coverLetterResult', 'Please upload a resume and provide a job description first.');
            return;
        }

        const rateCheck = checkRateLimit(socket, 'generateCoverLetter');
        if (!rateCheck.allowed) {
            socket.emit('rateLimited', { reason: rateCheck.reason, message: rateCheck.message });
            socket.emit('coverLetterResult', '⏳ Rate limit active. Please wait a moment before generating a cover letter again.');
            return;
        }

        try {
            const promptParts = [`
Act as a Professional Resume Writer.
TASK: Write a compelling Cover Letter for a candidate applying to a job.
CANDIDATE RESUME: "${session.resume.substring(0, 5000)}"
TARGET JOB DESCRIPTION: "${jobDescription.substring(0, 3000)}"
Output pure text/markdown.
`];

            const result = await aiEngine.cascadeGemini(promptParts, { requestId });
            const text = await (await result.response).text();
            session.coverLetter = text;
            socket.emit('coverLetterResult', text);
        } catch (e) {
            console.warn(`[${requestId}] Cover letter generation failed: ${e.message}`);
            socket.emit('coverLetterResult', "Cover letter generation temporarily unavailable in offline mode. Please configure an active AI key.");
        } finally {
            releaseRateLimit(socket.id, 'generateCoverLetter');
        }
    });

    // PREDICT QUESTIONS
    socket.on('predictQuestions', async () => {
        const requestId = crypto.randomBytes(4).toString('hex');

        const rateCheck = checkRateLimit(socket, 'predictQuestions');
        if (!rateCheck.allowed) {
            socket.emit('rateLimited', { reason: rateCheck.reason, message: rateCheck.message });
            socket.emit('predictionResult', [
                "⏳ Rate limit active. Please wait a moment before predicting questions again."
            ]);
            return;
        }

        try {
            const { role, company } = session.settings;
            const promptParts = [`
Act as a Hiring Manager at ${company || "a Tech Company"}.
Role: ${role || "Software Engineer"}.
Generate 5 precise interview questions. Return JSON: { "questions": ["Q1", "Q2", ...] }
`];

            const result = await aiEngine.cascadeGemini(promptParts, { requestId });
            const text = await (await result.response).text();
            const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(clean);
            socket.emit('predictionResult', parsed.questions);
        } catch (e) {
            console.warn(`[${requestId}] Question prediction failed: ${e.message}. Using offline default.`);
            socket.emit('predictionResult', [
                "Explain the Virtual DOM and React reconciliation.",
                "How do you design for scalability and handle state management?",
                "Tell me about a time you resolved a challenging production outage.",
                "Design a distributed URL shortener system."
            ]);
        } finally {
            releaseRateLimit(socket.id, 'predictQuestions');
        }
    });
});

// =============================================================================
// UPLOAD ENDPOINT (BOUNDED PAYLOAD & RATE-LIMITED)
// =============================================================================

const uploadFields = upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'resume', maxCount: 1 }
]);

app.post('/api/upload-resume', (req, res, next) => {
    const rateCheck = checkHttpUploadRateLimit(req);
    if (!rateCheck.allowed) {
        return res.status(429).json({
            success: false,
            status: 'error',
            error: `Too many upload requests. Please retry in ${rateCheck.retryAfter} seconds.`
        });
    }

    uploadFields(req, res, (err) => {
        if (err) return next(err);
        const uploadedFile = (req.files && (req.files['file']?.[0] || req.files['resume']?.[0])) || req.file;
        req.file = uploadedFile;
        next();
    });
}, async (req, res) => {
    const requestId = crypto.randomBytes(4).toString('hex');
    try {
        if (!req.file) return res.status(400).json({ success: false, status: 'error', error: 'No file uploaded.' });

        let text = "";
        const mimeType = req.file.mimetype;

        console.log(`[${requestId}] 📁 Upload: ${mimeType} (${(req.file.size / 1024).toFixed(1)}KB)`);

        if (mimeType === 'application/pdf') {
            try {
                const data = await pdf(req.file.buffer);
                text = data.text;
                if (text.trim().length < 50) throw new Error("Scanned PDF detected");
            } catch (e) {
                // Try Gemini vision OCR
                try {
                    const promptParts = [
                        { inlineData: { data: req.file.buffer.toString('base64'), mimeType: 'application/pdf' } },
                        "Transcribe the text of this document verbatim."
                    ];
                    const ocrResult = await aiEngine.cascadeGemini(promptParts, { requestId });
                    text = (await ocrResult.response).text();
                } catch (ocrErr) {
                    throw new Error("PDF text extraction failed and Vision OCR unavailable");
                }
            }
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            text = result.value;
        } else if (mimeType.startsWith('image/')) {
            const promptParts = [
                { inlineData: { data: req.file.buffer.toString('base64'), mimeType: mimeType } },
                "Transcribe the full text of this resume verbatim."
            ];
            const ocrResult = await aiEngine.cascadeGemini(promptParts, { requestId });
            text = (await ocrResult.response).text();
        } else {
            text = req.file.buffer.toString('utf8');
        }

        text = text.replace(/\n+/g, " ").trim();
        console.log(`[${requestId}] ✅ Resume parsed: ${text.length} chars`);

        res.json({ success: true, status: 'success', length: text.length, text: text });
    } catch (err) {
        console.error(`[${requestId}] Upload error:`, err.message);
        res.status(500).json({ success: false, status: 'error', error: 'Failed to process file. Please try a different format.' });
    }
});

// =============================================================================
// ERROR HANDLER
// =============================================================================

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ success: false, status: 'error', error: 'File too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ success: false, status: 'error', error: 'File upload error.' });
    }
    if (err.message?.includes('Unsupported file type')) {
        return res.status(400).json({ success: false, status: 'error', error: err.message });
    }
    console.error('Unhandled error:', err.message);
    res.status(500).json({ success: false, status: 'error', error: 'Internal server error.' });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

httpServer.listen(PORT, () => {
    console.log(`\n🚀 Server listening on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   CORS: ${ALL_ORIGINS.join(', ')}\n`);
});
