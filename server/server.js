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
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { AIEngine, FastEngine, classifyError, getOpaqueKeyLabel, validateGeminiCredentialFormat, validateOpenAICredentialFormat, logProviderAttempt } from './ai_engine.js';
import { RAGEngine, normalizeDocumentText } from './rag_engine.js';

const require = createRequire(import.meta.url);
const pdfParseModule = require("pdf-parse");

async function extractPdfDocument(buffer) {
    if (!buffer || buffer.length === 0) {
        throw new Error('EMPTY_FILE: Uploaded PDF file is empty');
    }
    if (typeof pdfParseModule === 'function') {
        const data = await pdfParseModule(buffer);
        return {
            text: data?.text || '',
            pageCount: data?.numpages || null,
            pages: null
        };
    }
    if (pdfParseModule && typeof pdfParseModule.PDFParse === 'function') {
        const parser = new pdfParseModule.PDFParse({ data: buffer });
        const result = await parser.getText();
        if (typeof parser.destroy === 'function') await parser.destroy();
        const pages = Array.isArray(result?.pages)
            ? result.pages.map((p, idx) => ({
                pageNumber: p.num || idx + 1,
                text: p.text || ''
            }))
            : null;
        return {
            text: result?.text || '',
            pageCount: result?.total || (pages ? pages.length : null),
            pages
        };
    }
    if (typeof pdfParseModule?.default === 'function') {
        const data = await pdfParseModule.default(buffer);
        return {
            text: data?.text || '',
            pageCount: data?.numpages || null,
            pages: null
        };
    }
    throw new Error('Unsupported pdf-parse export format');
}

async function extractPdfText(buffer) {
    const doc = await extractPdfDocument(buffer);
    return doc.text || '';
}

async function cascadeVisionContent(buffer, mimeType, requestId = 'ocr') {
    const promptParts = [
        { inlineData: { data: buffer.toString('base64'), mimeType } },
        'Transcribe the full text of this document verbatim. Do not summarize. Just return the text content.'
    ];
    const result = await aiEngine.cascadeGemini(promptParts, { requestId });
    const response = await result.response;
    return typeof response.text === 'function' ? response.text() : (response.text || '');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

function isOriginAllowed(origin) {
    if (!origin) return true;
    if (ALL_ORIGINS.includes(origin)) return true;
    if (
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.onrender.com') ||
        origin.endsWith('.run.app') ||
        origin.endsWith('.aistudio.google.com') ||
        origin.endsWith('.googleusercontent.com')
    ) {
        return true;
    }
    return false;
}

// --- Environment Variable Validation ---
function validateConfig() {
    const openaiKey = process.env.OPENAI_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    const openaiValidation = validateOpenAICredentialFormat(openaiKey);
    const geminiValidation = validateGeminiCredentialFormat(geminiKey);

    let validNumberedKeys = 0;
    for (let i = 1; i <= 20; i++) {
        const k = process.env[`GEMINI_API_KEY_${i}`];
        if (k) {
            const v = validateGeminiCredentialFormat(k);
            if (v.valid) validNumberedKeys++;
        }
    }

    console.log('┌──────────────────────────────────────────────┐');
    console.log('│     Interview Copilot AI — Boot Check        │');
    console.log('├──────────────────────────────────────────────┤');
    console.log(`│ OpenAI Format:          ${openaiValidation.valid ? '✅ Valid (unverified)' : '⬚  Not configured'}     │`);
    console.log(`│ Gemini Format:          ${geminiValidation.valid ? `✅ Valid (${geminiValidation.keyType === 'AUTHORIZATION_KEY' ? 'AQ. auth key' : 'AIza standard key'})` : '⬚  Not configured'}   │`);
    console.log(`│ Gemini Extra Keys:      ${validNumberedKeys > 0 ? `✅ ${validNumberedKeys} valid key(s)` : '⬚  None'}            │`);
    console.log(`│ CORS Allowed Origins:   ${ALL_ORIGINS.length} domain(s)            │`);
    console.log('└──────────────────────────────────────────────┘');

    if (!openaiValidation.valid && !geminiValidation.valid && validNumberedKeys === 0) {
        console.warn('ℹ️  INFO: No valid AI provider keys configured. Operating in Offline Knowledge Engine mode.');
        console.warn('   Copy server/.env.example to server/.env and provide valid keys for live AI generation.');
    }

    return { openaiValidation, geminiValidation, validNumberedKeys };
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

// Instantiate Unified AI Engine & Multi-Tenant RAG Engine
export const aiEngine = new AIEngine({
    openAIKey: process.env.OPENAI_KEY,
    geminiKeys: UNIQUE_KEYS
});

export const ragEngine = new RAGEngine({
    aiEngine
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
        if (isOriginAllowed(origin)) return callback(null, true);
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('CORS policy violation'));
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-session-id', 'Authorization'],
    credentials: false
}));

app.use(express.json({ limit: '5mb' }));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'text/markdown',
            'image/jpeg',
            'image/png',
            'image/webp'
        ];
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (allowedMimes.includes(file.mimetype) || (file.mimetype === 'application/octet-stream' && ['.md', '.txt'].includes(ext))) {
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
        origin: function (origin, callback) {
            if (isOriginAllowed(origin)) return callback(null, true);
            callback(new Error('CORS policy violation'));
        },
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
    ragEngine.clearOwnerScope(socketId);
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
    predictQuestions: { cooldownMs: 4000, maxConcurrent: 1 },
    ragIngest: { cooldownMs: 1500, maxConcurrent: 2 }
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

// Root route handled by static frontend middleware below

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
    } else if (health.gemini.status === 'AUTH_FAILED' || health.openai.status === 'AUTH_FAILED') {
        res.status(503).json({
            ready: false,
            status: 'AUTH_FAILED',
            message: 'AI provider authentication failed during live request'
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


function emitProviderStatus(socket) {
    const health = aiEngine.getProviderHealth();
    socket.emit('providerStatus', {
        hasOpenAI: health.openai.liveVerified || health.openai.formatValid,
        hasGemini: health.gemini.liveVerified || health.gemini.formatValid,
        isOnline: health.liveAIReady || (health.gemini.formatValid && health.gemini.keysActive > 0) || health.openai.formatValid,
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
}

io.on('connection', (socket) => {
    console.log(`🔗 Connected: ${socket.id}`);
    const session = getSession(socket.id);

    // Initial state sync with settings isolation
    socket.on('requestSessionState', () => {
        const docs = ragEngine.listDocuments(socket.id);
        socket.emit('sessionStateUpdate', {
            analysis: session.analysis,
            coverLetter: session.coverLetter,
            resumeLoaded: !!session.resume || docs.some(d => d.docType === 'resume'),
            documents: docs,
            settings: {
                role: session.settings.role,
                company: session.settings.company,
                tone: session.settings.tone,
                detailLevel: session.settings.detailLevel
            }
        });
        socket.emit('rag:documentsList', docs);
        if (session.resume || docs.some(d => d.docType === 'resume')) {
            socket.emit('resumeConfirmed', "Resume received and analyzed.");
        }
        emitProviderStatus(socket);
    });

    // Report provider status truthfully
    emitProviderStatus(socket);

    socket.on('disconnect', () => {
        console.log(`🔌 Disconnected: ${socket.id}`);
        destroySession(socket.id);
        cleanupSocketLimits(socket.id);
    });

    socket.on('updateResume', async (resumeText) => {
        if (typeof resumeText !== 'string' || resumeText.length > 50000) {
            socket.emit('error', 'Resume text too long (max 50,000 characters)');
            return;
        }
        session.resume = resumeText;
        socket.emit('resumeConfirmed', "Resume received and analyzed.");

        // Automatically index resume into the session's RAG vector store if non-trivial
        if (resumeText.trim().length >= 15) {
            try {
                socket.emit('rag:documentStatus', { status: 'indexing', filename: 'Candidate_Resume.txt', docType: 'resume' });
                const docMeta = await ragEngine.ingestDocument({
                    ownerId: socket.id,
                    filename: 'Candidate_Resume.txt',
                    docType: 'resume',
                    mimeType: 'text/plain',
                    text: resumeText,
                    replaceExistingType: true,
                    requestId: `resume-${crypto.randomBytes(3).toString('hex')}`
                });
                socket.emit('rag:documentStatus', { status: 'indexed', document: docMeta });
                socket.emit('rag:documentsList', ragEngine.listDocuments(socket.id));
            } catch (err) {
                socket.emit('rag:documentStatus', {
                    status: 'error',
                    filename: 'Candidate_Resume.txt',
                    code: err.code || 'INDEX_FAILED',
                    error: err.message
                });
            }
        }
    });

    // RAG DOCUMENT MANAGEMENT SOCKET EVENTS
    socket.on('rag:listDocuments', () => {
        socket.emit('rag:documentsList', ragEngine.listDocuments(socket.id));
    });

    socket.on('rag:uploadDocument', async (payload) => {
        const requestId = crypto.randomBytes(4).toString('hex');
        if (!payload || typeof payload !== 'object') {
            socket.emit('rag:documentStatus', { status: 'error', error: 'Invalid document payload.' });
            return;
        }

        const rateCheck = checkRateLimit(socket, 'ragIngest');
        if (!rateCheck.allowed) {
            socket.emit('rateLimited', { reason: rateCheck.reason, message: rateCheck.message });
            socket.emit('rag:documentStatus', { status: 'error', error: rateCheck.message });
            return;
        }

        try {
            const filename = typeof payload.filename === 'string' ? payload.filename : 'document.txt';
            const docType = typeof payload.docType === 'string' ? payload.docType : 'general';
            const text = typeof payload.text === 'string' ? payload.text : '';
            const pages = Array.isArray(payload.pages) ? payload.pages : null;
            const pageCount = payload.pageCount || null;

            socket.emit('rag:documentStatus', { status: 'indexing', filename, docType });

            const docMeta = await ragEngine.ingestDocument({
                ownerId: socket.id,
                filename,
                docType,
                mimeType: payload.mimeType || 'text/plain',
                text,
                pages,
                pageCount,
                replaceExistingType: Boolean(payload.replaceExistingType),
                requestId
            });

            if (docType === 'resume' && text.trim().length > 0) {
                session.resume = text.slice(0, 50000);
                socket.emit('resumeConfirmed', "Resume received and analyzed.");
            }

            socket.emit('rag:documentStatus', { status: 'indexed', document: docMeta });
            socket.emit('rag:documentsList', ragEngine.listDocuments(socket.id));
        } catch (err) {
            socket.emit('rag:documentStatus', {
                status: 'error',
                code: err.code || 'INGEST_ERROR',
                error: err.message
            });
        } finally {
            releaseRateLimit(socket.id, 'ragIngest');
        }
    });

    socket.on('rag:deleteDocument', (payload) => {
        const docId = typeof payload === 'string' ? payload : payload?.docId;
        if (!docId || typeof docId !== 'string') {
            socket.emit('rag:documentStatus', { status: 'error', error: 'Missing document ID.' });
            return;
        }
        const deleted = ragEngine.deleteDocument(socket.id, docId);
        const remainingDocs = ragEngine.listDocuments(socket.id);
        if (!remainingDocs.some(d => d.docType === 'resume')) {
            session.resume = "";
        }
        socket.emit('rag:documentDeleted', { docId, deleted });
        socket.emit('rag:documentsList', remainingDocs);
    });

    socket.on('rag:reindexDocument', async (payload) => {
        const docId = typeof payload === 'string' ? payload : payload?.docId;
        if (!docId || typeof docId !== 'string') return;
        try {
            socket.emit('rag:documentStatus', { status: 'indexing', docId });
            const updated = await ragEngine.reindexDocument(socket.id, docId);
            socket.emit('rag:documentStatus', { status: 'indexed', document: updated });
            socket.emit('rag:documentsList', ragEngine.listDocuments(socket.id));
        } catch (err) {
            socket.emit('rag:documentStatus', { status: 'error', docId, error: err.message });
        }
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

    // MAIN QUESTION HANDLER (WITH GENUINE RAG RETRIEVAL)
    socket.on('question', async (data) => {
        const requestId = crypto.randomBytes(4).toString('hex');

        const rateCheck = checkRateLimit(socket, 'question');
        if (!rateCheck.allowed) {
            console.log(`[${requestId}] ⏳ Rate limited (${rateCheck.reason}): ${socket.id}`);
            socket.emit('rateLimited', { reason: rateCheck.reason, message: rateCheck.message });
            return;
        }

        const abortController = new AbortController();
        const onDisconnect = () => abortController.abort();
        socket.once('disconnect', onDisconnect);

        try {
            let transcript = "";
            let image = null;
            let topK = undefined;
            let docIds = undefined;
            if (typeof data === 'string') {
                transcript = data;
            } else if (typeof data === 'object' && data !== null) {
                transcript = typeof data.transcript === 'string' ? data.transcript : "";
                image = typeof data.image === 'string' ? data.image : null;
                topK = data.topK;
                docIds = data.docIds;
            }

            if (transcript.trim().length === 0 && !image) return;
            if (transcript.length > 5000) transcript = transcript.substring(0, 5000);

            console.log(`[${requestId}] 📥 Question: [${transcript.length} chars] ${image ? '+ [Image payload]' : ''}`);

            socket.emit('answerChunk', { chunk: "🔄 *Analyzing question...*\n\n", isFirst: true });

            // Perform semantic RAG retrieval over the socket owner's indexed documents
            let ragContext = null;
            const ownerDocs = ragEngine.listDocuments(socket.id);
            if (ownerDocs.length > 0 && transcript.trim().length > 0) {
                try {
                    ragContext = await ragEngine.retrieveContext(socket.id, transcript, {
                        requestId: `${requestId}-rag`,
                        topK,
                        docIds
                    });
                } catch (ragErr) {
                    console.warn(`[${requestId}] ⚠️ RAG retrieval error: ${ragErr.message}`);
                    ragContext = {
                        status: 'EMBEDDING_ERROR',
                        error: ragErr.message,
                        chunks: [],
                        sources: [],
                        totalIndexedChunks: 0
                    };
                }
            }

            const result = await aiEngine.generateAnswer(
                transcript, image, session, requestId,
                (chunkText, isFirst) => {
                    if (!socket.connected || abortController.signal.aborted) {
                        return false;
                    }
                    socket.emit('answerChunk', { chunk: chunkText, isFirst });
                },
                { signal: abortController.signal, ragContext }
            );

            if (!abortController.signal.aborted) {
                const isGrounded = Boolean(!result.isOffline && result.grounded);
                socket.emit('rag:contextUsed', {
                    grounded: isGrounded,
                    status: result.isOffline
                        ? 'OFFLINE_FALLBACK'
                        : (ragContext?.status || 'NO_DOCUMENTS'),
                    sources: isGrounded ? (result.ragSources || []) : [],
                    totalIndexedChunks: ragContext?.totalIndexedChunks || 0,
                    embeddingModel: ragContext?.queryEmbeddingModel || null,
                    provider: result.provider,
                    model: result.model
                });

                if (result.isOffline) {
                    socket.emit('answer', `📴 **Offline Mode**\nNo AI provider is currently available. Using built-in knowledge base.\n\n${result.text}`);
                } else {
                    socket.emit('answer', result.text);
                }
            }

        } catch (error) {
            if (!abortController.signal.aborted) {
                console.error(`[${requestId}] ❌ AI Error:`, error.message);
                const transcript_fallback = typeof data === 'string' ? data : data?.transcript || '';
                const offlineAnswer = FastEngine.generateAnswer(transcript_fallback);
                socket.emit('rag:contextUsed', {
                    grounded: false,
                    status: 'OFFLINE_FALLBACK',
                    sources: [],
                    totalIndexedChunks: 0
                });
                socket.emit('answer', `📴 **Offline Mode**\nAI providers temporarily unavailable. Using built-in knowledge base.\n\n${offlineAnswer}`);
            }
        } finally {
            socket.off('disconnect', onDisconnect);
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

        const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
        // Filler Word Detection (word-boundary match to avoid false positives like "likely")
        const fillers = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally'];
        const lowerTranscript = transcript.toLowerCase();
        const foundFillers = fillers.filter(w => new RegExp(`\\b${w}\\b`).test(lowerTranscript));

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

async function extractUploadedFileContent(file, requestId = 'upload') {
    if (!file || !file.buffer || file.size === 0) {
        const err = new Error('Uploaded file is empty (0 bytes).');
        err.statusCode = 400;
        err.code = 'EMPTY_FILE';
        throw err;
    }

    const mimeType = file.mimetype;
    let text = '';
    let pageCount = null;
    let pages = null;

    if (mimeType === 'application/pdf') {
        try {
            const pdfData = await extractPdfDocument(file.buffer);
            text = pdfData.text || '';
            pageCount = pdfData.pageCount;
            pages = pdfData.pages;
            if (text.trim().length < 20) throw new Error('Scanned or empty PDF detected');
        } catch (e) {
            // Try Gemini vision OCR only if buffer looks like a valid PDF header (%PDF-)
            const header = file.buffer.slice(0, 5).toString('utf8');
            if (!header.startsWith('%PDF-')) {
                const corruptErr = new Error('Corrupted or invalid PDF file.');
                corruptErr.statusCode = 422;
                corruptErr.code = 'CORRUPTED_FILE';
                throw corruptErr;
            }
            try {
                text = await cascadeVisionContent(file.buffer, 'application/pdf', requestId);
            } catch {
                const ocrErr = new Error('PDF text extraction failed and Vision OCR unavailable.');
                ocrErr.statusCode = 422;
                ocrErr.code = 'EXTRACTION_FAILED';
                throw ocrErr;
            }
        }
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        try {
            const result = await mammoth.extractRawText({ buffer: file.buffer });
            text = result.value || '';
        } catch {
            const docxErr = new Error('Corrupted or unreadable DOCX file.');
            docxErr.statusCode = 422;
            docxErr.code = 'CORRUPTED_FILE';
            throw docxErr;
        }
    } else if (mimeType.startsWith('image/')) {
        text = await cascadeVisionContent(file.buffer, mimeType, requestId);
    } else {
        text = file.buffer.toString('utf8');
    }

    const normalized = normalizeDocumentText(text);
    if (!normalized) {
        const emptyErr = new Error('No readable text could be extracted from the file.');
        emptyErr.statusCode = 422;
        emptyErr.code = 'EMPTY_DOCUMENT';
        throw emptyErr;
    }

    return {
        text: normalized,
        flatText: normalized.replace(/\n+/g, ' ').trim(),
        pageCount,
        pages
    };
}

function resolveOwnerSessionId(req) {
    const rawId = req.headers['x-session-id'] || req.body?.sessionId || req.query?.sessionId;
    if (typeof rawId === 'string' && rawId.trim().length > 0 && rawId.trim().length <= 128) {
        return rawId.trim();
    }
    return null;
}

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

        const mimeType = req.file.mimetype;
        console.log(`[${requestId}] 📁 Upload: ${mimeType} (${(req.file.size / 1024).toFixed(1)}KB)`);

        const extracted = await extractUploadedFileContent(req.file, requestId);
        console.log(`[${requestId}] ✅ Resume parsed: ${extracted.flatText.length} chars`);

        // If client provided a sessionId, also index into RAG engine with page/section metadata
        const ownerId = resolveOwnerSessionId(req);
        let ragDocument = null;
        let ragError = null;
        if (ownerId) {
            try {
                ragDocument = await ragEngine.ingestDocument({
                    ownerId,
                    filename: req.file.originalname || 'Resume.pdf',
                    docType: req.body?.docType || 'resume',
                    mimeType,
                    text: extracted.text,
                    pages: extracted.pages,
                    pageCount: extracted.pageCount,
                    replaceExistingType: (req.body?.docType || 'resume') === 'resume',
                    requestId
                });
                if (sessions.has(ownerId) && (req.body?.docType || 'resume') === 'resume') {
                    sessions.get(ownerId).resume = extracted.text.slice(0, 50000);
                }
                const targetSocket = io.sockets.sockets.get(ownerId);
                if (targetSocket) {
                    targetSocket.emit('rag:documentsList', ragEngine.listDocuments(ownerId));
                }
            } catch (e) {
                ragError = e.message;
            }
        }

        res.json({
            success: true,
            status: 'success',
            length: extracted.flatText.length,
            text: extracted.flatText,
            structuredText: extracted.text,
            pageCount: extracted.pageCount,
            ragDocument,
            ragError
        });
    } catch (err) {
        console.error(`[${requestId}] Upload error:`, err.message);
        const status = err.statusCode || 500;
        res.status(status).json({
            success: false,
            status: 'error',
            code: err.code || 'UPLOAD_ERROR',
            error: status < 500 ? err.message : 'Failed to process file. Please try a different format.'
        });
    }
});

// =============================================================================
// RAG DOCUMENT MANAGEMENT & RETRIEVAL REST ENDPOINTS
// =============================================================================

app.post('/api/rag/documents', (req, res, next) => {
    const rateCheck = checkHttpUploadRateLimit(req);
    if (!rateCheck.allowed) {
        return res.status(429).json({
            success: false,
            error: `Too many upload requests. Please retry in ${rateCheck.retryAfter} seconds.`
        });
    }
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
        uploadFields(req, res, (err) => {
            if (err) return next(err);
            req.file = (req.files && (req.files['file']?.[0] || req.files['resume']?.[0])) || req.file;
            next();
        });
    } else {
        next();
    }
}, async (req, res) => {
    const requestId = crypto.randomBytes(4).toString('hex');
    try {
        const ownerId = resolveOwnerSessionId(req);
        if (!ownerId) {
            return res.status(400).json({
                success: false,
                code: 'MISSING_SESSION_ID',
                error: 'A valid sessionId (via x-session-id header or body) is required for document ownership isolation.'
            });
        }

        const docType = req.body?.docType || 'general';
        let filename = req.body?.filename || 'document.txt';
        let mimeType = 'text/plain';
        let text = '';
        let pages = null;
        let pageCount = null;

        if (req.file) {
            filename = req.file.originalname || filename;
            mimeType = req.file.mimetype;
            const extracted = await extractUploadedFileContent(req.file, requestId);
            text = extracted.text;
            pages = extracted.pages;
            pageCount = extracted.pageCount;
        } else if (typeof req.body?.text === 'string') {
            text = req.body.text;
            pages = Array.isArray(req.body.pages) ? req.body.pages : null;
            pageCount = req.body.pageCount || null;
        } else {
            return res.status(400).json({
                success: false,
                code: 'MISSING_DOCUMENT_CONTENT',
                error: 'Provide either a file upload or a non-empty text field.'
            });
        }

        const document = await ragEngine.ingestDocument({
            ownerId,
            filename,
            docType,
            mimeType,
            text,
            pages,
            pageCount,
            replaceExistingType: Boolean(req.body?.replaceExistingType),
            requestId
        });

        if (docType === 'resume' && sessions.has(ownerId)) {
            sessions.get(ownerId).resume = text.slice(0, 50000);
        }

        const targetSocket = io.sockets.sockets.get(ownerId);
        if (targetSocket) {
            targetSocket.emit('rag:documentStatus', { status: 'indexed', document });
            targetSocket.emit('rag:documentsList', ragEngine.listDocuments(ownerId));
            if (docType === 'resume') {
                targetSocket.emit('resumeConfirmed', "Resume received and analyzed.");
            }
        }

        res.status(201).json({
            success: true,
            document,
            documents: ragEngine.listDocuments(ownerId)
        });
    } catch (err) {
        const status = err.statusCode || (err.code === 'EMPTY_DOCUMENT' || err.code === 'EMPTY_CHUNKS' ? 400 : err.code === 'EMBEDDING_PROVIDER_UNAVAILABLE' ? 503 : 500);
        res.status(status).json({
            success: false,
            code: err.code || 'RAG_INGEST_FAILED',
            error: err.message
        });
    }
});

app.get('/api/rag/documents', (req, res) => {
    const ownerId = resolveOwnerSessionId(req);
    if (!ownerId) {
        return res.status(400).json({
            success: false,
            code: 'MISSING_SESSION_ID',
            error: 'sessionId is required to list session documents.'
        });
    }
    res.json({
        success: true,
        documents: ragEngine.listDocuments(ownerId)
    });
});

app.delete('/api/rag/documents/:docId', (req, res) => {
    const ownerId = resolveOwnerSessionId(req);
    if (!ownerId) {
        return res.status(400).json({
            success: false,
            code: 'MISSING_SESSION_ID',
            error: 'sessionId is required to delete a document.'
        });
    }
    const { docId } = req.params;
    const deleted = ragEngine.deleteDocument(ownerId, docId);
    if (!deleted) {
        return res.status(404).json({
            success: false,
            code: 'DOCUMENT_NOT_FOUND',
            error: 'Document not found or not owned by this session.'
        });
    }

    const remainingDocs = ragEngine.listDocuments(ownerId);
    if (sessions.has(ownerId) && !remainingDocs.some(d => d.docType === 'resume')) {
        sessions.get(ownerId).resume = "";
    }

    const targetSocket = io.sockets.sockets.get(ownerId);
    if (targetSocket) {
        targetSocket.emit('rag:documentDeleted', { docId, deleted: true });
        targetSocket.emit('rag:documentsList', remainingDocs);
    }

    res.json({
        success: true,
        docId,
        deleted: true,
        documents: remainingDocs
    });
});

app.post('/api/rag/documents/:docId/reindex', async (req, res) => {
    const ownerId = resolveOwnerSessionId(req);
    if (!ownerId) {
        return res.status(400).json({
            success: false,
            code: 'MISSING_SESSION_ID',
            error: 'sessionId is required to re-index a document.'
        });
    }
    try {
        const document = await ragEngine.reindexDocument(ownerId, req.params.docId);
        const targetSocket = io.sockets.sockets.get(ownerId);
        if (targetSocket) {
            targetSocket.emit('rag:documentStatus', { status: 'indexed', document });
            targetSocket.emit('rag:documentsList', ragEngine.listDocuments(ownerId));
        }
        res.json({
            success: true,
            document,
            documents: ragEngine.listDocuments(ownerId)
        });
    } catch (err) {
        const status = err.code === 'DOCUMENT_NOT_FOUND' ? 404 : 500;
        res.status(status).json({
            success: false,
            code: err.code || 'REINDEX_FAILED',
            error: err.message
        });
    }
});

app.post('/api/rag/query', async (req, res) => {
    const requestId = crypto.randomBytes(4).toString('hex');
    const ownerId = resolveOwnerSessionId(req);
    if (!ownerId) {
        return res.status(400).json({
            success: false,
            code: 'MISSING_SESSION_ID',
            error: 'sessionId is required to query session documents.'
        });
    }
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!question) {
        return res.status(400).json({
            success: false,
            code: 'EMPTY_QUESTION',
            error: 'A non-empty question is required.'
        });
    }

    try {
        const ragContext = await ragEngine.retrieveContext(ownerId, question.slice(0, 5000), {
            requestId,
            topK: req.body?.topK,
            minScore: req.body?.minScore,
            docIds: req.body?.docIds,
            docType: req.body?.docType
        });

        if (req.body?.retrieveOnly) {
            return res.json({
                success: true,
                retrievalStatus: ragContext.status,
                grounded: ragContext.chunks.length > 0,
                sources: ragContext.sources,
                totalIndexedChunks: ragContext.totalIndexedChunks
            });
        }

        const session = sessions.get(ownerId) || { settings: {} };
        const answerResult = await aiEngine.generateAnswer(
            question.slice(0, 5000),
            null,
            session,
            requestId,
            null,
            { ragContext }
        );

        res.json({
            success: true,
            retrievalStatus: answerResult.isOffline ? 'OFFLINE_FALLBACK' : ragContext.status,
            grounded: Boolean(!answerResult.isOffline && answerResult.grounded),
            answer: answerResult.text,
            sources: !answerResult.isOffline && answerResult.grounded ? answerResult.ragSources : [],
            provider: answerResult.provider,
            model: answerResult.model,
            isOffline: answerResult.isOffline
        });
    } catch (err) {
        res.status(err.code === 'EMBEDDING_PROVIDER_UNAVAILABLE' ? 503 : 500).json({
            success: false,
            code: err.code || 'RAG_QUERY_FAILED',
            error: err.message
        });
    }
});

// =============================================================================
// STATIC FRONTEND & SPA FALLBACK
// =============================================================================

const clientDir = path.resolve(__dirname, '../client');
const clientDistPath = path.resolve(clientDir, 'dist');
const clientIndexHtml = path.join(clientDistPath, 'index.html');

let clientBuildPromise = null;
function ensureClientBuild() {
    if (fs.existsSync(clientIndexHtml)) {
        return Promise.resolve(true);
    }
    if (clientBuildPromise) {
        return clientBuildPromise;
    }
    console.log('⚙️ [Startup] Building client/dist in background...');
    clientBuildPromise = new Promise((resolve) => {
        const child = spawn('npm', ['--prefix', clientDir, 'run', 'build'], {
            stdio: 'inherit',
            env: process.env
        });
        child.on('close', (code) => {
            clientBuildPromise = null;
            if (code === 0 && fs.existsSync(clientIndexHtml)) {
                console.log('✅ [Startup] Frontend client/dist build complete.');
                resolve(true);
            } else {
                console.warn(`⚠️ [Startup] Frontend build exited with code ${code}`);
                resolve(false);
            }
        });
        child.on('error', (err) => {
            clientBuildPromise = null;
            console.warn(`⚠️ [Startup] Frontend build error: ${err.message}`);
            resolve(false);
        });
    });
    return clientBuildPromise;
}

app.use(express.static(clientDistPath));
app.use(async (req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/health') && !req.path.startsWith('/socket.io')) {
        if (!fs.existsSync(clientIndexHtml)) {
            await ensureClientBuild();
        }
        return res.sendFile(clientIndexHtml, (err) => {
            if (err && !res.headersSent) {
                res.status(200).send('Interview Copilot AI Server is running.');
            }
        });
    }
    next();
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

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server listening on http://0.0.0.0:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   CORS: ${ALL_ORIGINS.join(', ')}\n`);

    if (!fs.existsSync(clientIndexHtml)) {
        ensureClientBuild();
    }

    if (UNIQUE_KEYS.length > 0) {
        aiEngine.verifyGeminiLive()
            .then(res => {
                if (res.success) {
                    console.log(`✅ [Startup] Gemini live verification succeeded: Ready for live AI responses.`);
                } else {
                    console.warn(`⚠️ [Startup] Gemini live verification unconfirmed: ${res.category} (${res.message})`);
                }
            })
            .catch(err => {
                console.warn(`⚠️ [Startup] Gemini live verification error: ${err.message}`);
            });
    }
});
