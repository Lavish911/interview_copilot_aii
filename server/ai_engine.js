import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { buildGroundedRAGPrompt } from './rag_engine.js';

// =============================================================================
// CANONICAL MODELS CONFIGURATION
// =============================================================================

export const CANONICAL_GEMINI_MODELS = Object.freeze([
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite"
]);

export const CANONICAL_GEMINI_EMBEDDING_MODELS = Object.freeze(
    process.env.GEMINI_EMBEDDING_MODEL
        ? [process.env.GEMINI_EMBEDDING_MODEL, "gemini-embedding-001", "gemini-embedding-2-preview"]
        : ["gemini-embedding-001", "gemini-embedding-2-preview"]
);

export const CANONICAL_OPENAI_MODEL = "gpt-4o-mini";
export const CANONICAL_OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

// =============================================================================
// KNOWLEDGE BASE (Offline AI Fallback — Tier 3)
// =============================================================================

export const KNOWLEDGE_BASE = {
    "react": "### ⚛️ React Deep Dive\n**Core Concepts:**\n- **Virtual DOM**: Lightweight memory representation of the DOM synced with real DOM via reconciliation.\n- **Hooks**: `useState`, `useEffect`, `useMemo`, `useCallback` for functional lifecycle.\n- **Fiber Architecture**: Incremental rendering enabling prioritization and interruption.\n- **Context API**: State broadcasting without prop drilling.",
    "css": "### 🎨 CSS Mastery\n- **Flexbox vs Grid**: Flex is 1-dimensional (content-first); Grid is 2-dimensional (layout-first).\n- **Box Model**: Margin, Border, Padding, Content.\n- **Cascade & Specificity**: Inline > ID > Class/Attribute > Element.\n- **Responsive Design**: Mobile-first media queries and relative typography (`rem`, `ch`, `clamp`).",
    "performance": "### 🚀 Web Performance\n- **Core Web Vitals**: LCP (loading), INP/FID (interactivity), CLS (visual stability).\n- **Network Optimization**: Brotli compression, HTTP/2 multiplexing, CDN caching, image optimization (`webp`, `avif`).\n- **Runtime Optimization**: Code splitting with dynamic `import()`, virtualization for long lists, debouncing heavy handlers.",
    "node": "### 🟢 Node.js Architecture\n- **Event Loop**: Powered by libuv. Phases: Timers → Pending Callbacks → Idle/Prepare → Poll → Check (`setImmediate`) → Close.\n- **Asynchronous I/O**: Offloads file/DNS/crypto work to libuv worker threadpool.\n- **Streams**: Chunked data pipeline (`Readable`, `Writable`, `Transform`) preventing memory exhaustion.",
    "database": "### 🗄️ Databases & Data Modeling\n- **Relational (ACID)**: PostgreSQL, MySQL. Strong consistency, normalization, foreign keys.\n- **NoSQL (BASE)**: MongoDB, DynamoDB, Redis. Schema flexibility, horizontal sharding.\n- **Indexing**: B-Tree for range/equality queries, Hash indexes for point lookups.",
    "api": "### 🔌 API Design\n- **REST**: Stateless, uniform interface, resource-oriented HTTP verbs (GET, POST, PUT, PATCH, DELETE).\n- **GraphQL**: Declarative schema, client-driven querying, prevents over/under-fetching.\n- **WebSockets / Socket.IO**: Bi-directional, persistent full-duplex TCP communication.",
    "dsa": "### 🧠 Data Structures & Algorithms\n- **Complexity**: Big-O notation measures asymptotic worst-case time and space growth.\n- **Hash Tables**: O(1) average lookup/insert via hash functions and collision resolution.\n- **Trees & Graphs**: BFS (Queue, shortest path) vs DFS (Stack/Recursion, topological sort, cycle detection).\n- **Sorting**: QuickSort (average O(n log n)), MergeSort (guaranteed O(n log n), stable).",
    "system design": "### 🏗️ System Design Principles\n- **Scalability**: Horizontal scaling behind Load Balancers (Layer 4 TCP vs Layer 7 HTTP).\n- **Caching**: Multi-tier caching (Browser → CDN → Gateway → Redis/Memcached → Database).\n- **CAP Theorem**: Consistency vs Availability under network Partitions.\n- **Reliability**: Circuit breakers, rate limiters (Token Bucket), exponential backoff with jitter.",
    "tell me about yourself": "### 👤 The Professional Pitch\n**Structure:**\n1. **Present**: 'I am a Software Engineer specializing in scalable full-stack web applications...'\n2. **Past**: 'Previously, I built and optimized production systems, focusing on performance, reliability, and clean architecture...'\n3. **Future**: 'Now, I am excited about this role because it directly aligns with my passion for high-impact technical challenges.'",
    "weakness": "### 🛡️ 'What is your greatest weakness?'\n**Strategy**: Genuine technical or procedural weakness + Active mitigation strategy.\n**Example**: 'Earlier in my career, I tended to over-engineer solutions before validating product demand. To fix this, I adopted strict MVP scoping and time-boxing.'",
    "default": "### 🤖 Technical Knowledge Engine (Offline Mode)\nI am ready. Ask about:\n- **Frontend**: React, CSS, Web Performance, State Management\n- **Backend**: Node.js, Event Loop, REST, System Design\n- **CS & Algorithms**: Big O, Data Structures, Concurrency\n- **Behavioral**: Pitch, Conflict, STAR Methodology"
};

export const FastEngine = {
    generateAnswer: (transcript = "") => {
        const t = transcript.toLowerCase();
        let bestMatch = "default";
        let highestScore = 0;

        Object.keys(KNOWLEDGE_BASE).forEach(key => {
            if (key === "default") return;
            const keyWords = key.split(' ');
            let score = 0;
            keyWords.forEach(w => { if (t.includes(w)) score += 1; });
            if (t.includes(key)) score += 2;
            if (score > highestScore) { highestScore = score; bestMatch = key; }
        });

        if (highestScore > 0) return KNOWLEDGE_BASE[bestMatch];
        if (t.includes("hello") || t.includes("hi")) return "### 👋 Ready to Interview\nI'm listening. Ask any technical question or practice behavioral scenarios.";
        if (t.includes("thank")) return "### 👍 You're Welcome!\nReady for the next interview question.";
        return KNOWLEDGE_BASE["default"];
    },
    generateMockQuestion: () => {
        const qs = [
            "Explain the difference between SQL and NoSQL databases and when you would choose each.",
            "How does the browser critical rendering path work from HTML parsing to pixel paint?",
            "Design a distributed rate limiter that handles 100,000 requests per second.",
            "What is a JavaScript closure and how can improper closures cause memory leaks?",
            "Explain the reconciliation algorithm and Fiber architecture in React."
        ];
        return qs[Math.floor(Math.random() * qs.length)];
    },
    analyzeResume: () => ({
        score: 85,
        keywords_missing: ["Kubernetes", "Redis", "Distributed Systems"],
        summary: "Solid software engineering profile. Highlights strong implementation skills; recommend quantifying production scale.",
        improvements: [
            { original: "Built full-stack application", improved: "Architected a high-concurrency full-stack platform serving 15k+ daily active users with 99.9% uptime." },
            { original: "Improved performance", improved: "Reduced API p99 latency by 42% through query optimization and Redis layer caching." }
        ]
    })
};

// =============================================================================
// CREDENTIAL FORMAT VALIDATION
// =============================================================================

export function validateGeminiCredentialFormat(key) {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
        return { valid: false, status: 'NOT_CONFIGURED', reason: 'Key is absent' };
    }
    const cleanKey = key.trim();
    if (cleanKey.includes('your_') || cleanKey.includes('placeholder') || cleanKey.length < 25) {
        return { valid: false, status: 'PLACEHOLDER', reason: 'Placeholder key detected' };
    }

    // Google AI Studio supports both legacy standard API keys (starting with AIza)
    // and modern authorization keys (starting with AQ., effective May 28, 2026).
    const isLegacyKey = cleanKey.startsWith('AIza');
    const isAuthKey = cleanKey.startsWith('AQ.');

    if (!isLegacyKey && !isAuthKey) {
        return {
            valid: false,
            status: 'INVALID_FORMAT',
            reason: 'Gemini API credentials must start with "AIza" (standard key) or "AQ." (authorization key)'
        };
    }

    // Verify key contains only valid URL-safe token characters without illegal spaces or symbols
    const validKeyPattern = /^[A-Za-z0-9_.-]+$/;
    if (!validKeyPattern.test(cleanKey)) {
        return {
            valid: false,
            status: 'INVALID_CHARACTERS',
            reason: 'Gemini credential contains invalid characters'
        };
    }

    return {
        valid: true,
        status: 'FORMAT_VALID',
        keyType: isAuthKey ? 'AUTHORIZATION_KEY' : 'STANDARD_KEY',
        reason: isAuthKey
            ? 'Conforms to Google AI Studio authorization key format (AQ.)'
            : 'Conforms to Google AI Studio standard API key format (AIza)'
    };
}

export function validateOpenAICredentialFormat(key) {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
        return { valid: false, status: 'NOT_CONFIGURED', reason: 'Key is absent' };
    }
    const cleanKey = key.trim();
    if (cleanKey.includes('your_') || cleanKey.includes('placeholder') || cleanKey.length < 20) {
        return { valid: false, status: 'PLACEHOLDER', reason: 'Placeholder key detected' };
    }
    if (!cleanKey.startsWith('sk-')) {
        return { valid: false, status: 'INVALID_FORMAT', reason: 'OpenAI API keys must start with "sk-"' };
    }
    return { valid: true, status: 'FORMAT_VALID', reason: 'Conforms to OpenAI API key format' };
}

// =============================================================================
// ERROR CLASSIFICATION & STRUCTURED LOGGING
// =============================================================================

export function getOpaqueKeyLabel(keyIndex = null, totalKeys = null) {
    if (keyIndex === null) return 'default_key';
    return totalKeys !== null ? `key_${keyIndex}_of_${totalKeys}` : `key_${keyIndex}`;
}

export function classifyError(error) {
    const msg = error?.message || String(error || '');
    const status = error?.status || error?.statusCode || null;

    if (
        msg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ||
        msg.includes('API_KEY_INVALID') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('UNAUTHENTICATED') ||
        status === 401 ||
        status === 403 ||
        msg.includes('invalid authentication credentials')
    ) {
        return { category: 'AUTH_ERROR', isPermanent: true, status: status || 401 };
    }

    if (
        status === 429 ||
        msg.includes('429') ||
        msg.includes('Too Many Requests') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('quota')
    ) {
        return { category: 'QUOTA_EXHAUSTED', isPermanent: false, status: status || 429 };
    }

    if (
        status === 404 ||
        msg.includes('404') ||
        msg.includes('not found') ||
        msg.includes('is not supported for generateContent')
    ) {
        return { category: 'MODEL_UNAVAILABLE', isPermanent: false, status: status || 404 };
    }

    if (
        status === 503 ||
        msg.includes('503') ||
        msg.includes('Overloaded') ||
        msg.includes('Service Unavailable')
    ) {
        return { category: 'SERVER_OVERLOAD', isPermanent: false, status: status || 503 };
    }

    if (msg.includes('SAFETY') || msg.includes('blocked')) {
        return { category: 'SAFETY_BLOCK', isPermanent: false, status: 200 };
    }

    const lowerMsg = msg.toLowerCase();
    if (
        lowerMsg.includes('timeout') ||
        lowerMsg.includes('timed out') ||
        lowerMsg.includes('etimedout') ||
        lowerMsg.includes('esockettimedout') ||
        status === 408 ||
        error?.name === 'TimeoutError' ||
        error?.name === 'AbortError' ||
        lowerMsg.includes('aborted')
    ) {
        return { category: 'TIMEOUT', isPermanent: false, status: 408 };
    }

    if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        return { category: 'NETWORK_ERROR', isPermanent: false, status: 502 };
    }

    return { category: 'UNKNOWN_ERROR', isPermanent: false, status: status || 500 };
}

export function withTimeout(promise, timeoutMs = 15000, timeoutMsg = "GEMINI_REQUEST_TIMEOUT", abortController = null) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            const err = new Error(`${timeoutMsg}: Operation timed out after ${timeoutMs}ms`);
            err.name = 'TimeoutError';
            err.status = 408;
            if (abortController) {
                try {
                    abortController.abort(err);
                } catch {
                    // Ignore abort error
                }
            }
            reject(err);
        }, timeoutMs);
    });
    return Promise.race([
        promise.finally(() => clearTimeout(timeoutId)),
        timeoutPromise
    ]);
}

export function logProviderAttempt({
    requestId = 'req',
    provider = 'provider',
    model = 'unknown',
    keyIndex = null,
    totalKeys = null,
    status = 'OK',
    durationMs = 0,
    errorCategory = null,
    errorMessage = null
}) {
    const keyInfo = keyIndex !== null ? ` | ${getOpaqueKeyLabel(keyIndex, totalKeys)}` : '';
    const errInfo = errorCategory ? ` | Error: ${errorCategory} (${errorMessage ? errorMessage.substring(0, 80) : 'none'})` : '';
    console.log(`[${requestId}] [${provider.toUpperCase()}] Model: ${model}${keyInfo} | Status: ${status} in ${durationMs}ms${errInfo}`);
}

// =============================================================================
// AI ENGINE CLASS
// =============================================================================

export class AIEngine {
    constructor(config = {}) {
        this.openAIKey = config.openAIKey || null;
        this.geminiKeys = config.geminiKeys || [];
        this.OpenAIClientClass = config.OpenAIClientClass || OpenAI;
        this.GoogleGenAIClass = config.GoogleGenAIClass || config.GoogleGenerativeAIClass || GoogleGenAI;
        // Keep alias for backwards compatibility
        this.GoogleGenerativeAIClass = this.GoogleGenAIClass;

        this.fallbackModels = config.fallbackModels || CANONICAL_GEMINI_MODELS;
        this.openAIModel = config.openAIModel || CANONICAL_OPENAI_MODEL;
        this.geminiEmbeddingModels = config.geminiEmbeddingModels || CANONICAL_GEMINI_EMBEDDING_MODELS;
        this.openAIEmbeddingModel = config.openAIEmbeddingModel || CANONICAL_OPENAI_EMBEDDING_MODEL;
        this.embeddingProvider = (config.embeddingProvider || process.env.RAG_EMBEDDING_PROVIDER || 'auto').toLowerCase();

        this.deadKeyTTLMs = config.deadKeyTTLMs || (5 * 60 * 1000); // 5 minutes for permanent auth errors
        this.transientKeyTTLMs = config.deadKeyTTLMs || config.transientKeyTTLMs || (15 * 1000); // 15s for transient 429/503/timeout
        this.deadKeyTimestamps = new Map();
        this.deadKeyReasons = new Map();
        this.globalKeyIndex = 0;
        this.requestTimeoutMs = config.requestTimeoutMs || 15000;

        // Credential format validation
        this.openAIValidation = validateOpenAICredentialFormat(this.openAIKey);
        this.openaiClient = null;
        if (this.openAIValidation.valid) {
            try {
                this.openaiClient = new this.OpenAIClientClass({ apiKey: this.openAIKey });
            } catch (err) {
                console.warn("⚠️ Failed to initialize OpenAI client:", err.message);
            }
        }

        // Deduplicate non-empty keys
        this.uniqueGeminiKeys = [...new Set(this.geminiKeys.filter(k => typeof k === 'string' && k.trim().length > 0))];
        this.geminiValidations = this.uniqueGeminiKeys.map(k => validateGeminiCredentialFormat(k));

        // Live verification tracking (tracks actual successful live responses)
        this.openAILiveVerified = false;
        this.geminiLiveVerified = false;
        this.geminiLiveModel = null;
        this.openAILastLiveError = null;
        this.geminiLastLiveError = null;
        this.activeProbePromise = null;
    }

    isKeyDead(key) {
        const timestamp = this.deadKeyTimestamps.get(key);
        if (!timestamp) return false;
        const reason = this.deadKeyReasons.get(key) || 'permanent';
        const ttl = reason === 'transient' ? this.transientKeyTTLMs : this.deadKeyTTLMs;
        if (Date.now() - timestamp > ttl) {
            this.deadKeyTimestamps.delete(key);
            this.deadKeyReasons.delete(key);
            console.log(`🔄 Key TTL expired — returned to active pool.`);
            return false;
        }
        return true;
    }

    markKeyDead(key, reason = 'permanent') {
        this.deadKeyTimestamps.set(key, Date.now());
        this.deadKeyReasons.set(key, reason);
    }

    /**
     * If all format-valid keys are currently in cooldown, release the oldest transiently
     * failed key (never permanently invalid AUTH_ERROR keys) so live requests can retry.
     */
    _releaseOldestTransientKeyIfAllCoolingDown(validKeys) {
        if (validKeys.some(k => !this.isKeyDead(k))) return;
        let oldestKey = null;
        let oldestTs = Infinity;
        for (const k of validKeys) {
            if (this.deadKeyReasons.get(k) === 'transient') {
                const ts = this.deadKeyTimestamps.get(k) || 0;
                if (ts < oldestTs) {
                    oldestTs = ts;
                    oldestKey = k;
                }
            }
        }
        if (oldestKey) {
            this.deadKeyTimestamps.delete(oldestKey);
            this.deadKeyReasons.delete(oldestKey);
            const idx = this.uniqueGeminiKeys.indexOf(oldestKey);
            if (idx !== -1) this.globalKeyIndex = idx;
        }
    }

    /**
     * Reports accurate provider configuration and readiness state.
     * Does NOT perform live external network calls on health checks.
     */
    getProviderHealth() {
        const validFormatKeys = this.uniqueGeminiKeys.filter(k => validateGeminiCredentialFormat(k).valid);
        const activeKeys = validFormatKeys.filter(k => !this.isKeyDead(k));

        const openAIConfigured = this.openAIKey !== null && this.openAIKey !== undefined && this.openAIKey.length > 0;
        const openAIFormatValid = this.openAIValidation.valid;
        const openAIReady = openAIFormatValid && this.openAILiveVerified;

        const geminiConfigured = this.uniqueGeminiKeys.length > 0;
        const geminiFormatValid = validFormatKeys.length > 0;
        const geminiReady = geminiFormatValid && activeKeys.length > 0 && this.geminiLiveVerified;

        const liveAIReady = openAIReady || geminiReady;

        let geminiStatus = 'NOT_CONFIGURED';
        if (geminiConfigured) {
            if (!geminiFormatValid) {
                geminiStatus = 'INVALID_CREDENTIAL_FORMAT';
            } else if (this.geminiLastLiveError?.category === 'AUTH_ERROR') {
                geminiStatus = 'AUTH_FAILED';
            } else if (activeKeys.length === 0) {
                geminiStatus = 'ALL_KEYS_EXHAUSTED_COOLDOWN';
            } else if (this.geminiLiveVerified) {
                geminiStatus = 'LIVE_VERIFIED';
            } else if (this.geminiLastLiveError?.category === 'TIMEOUT') {
                geminiStatus = 'TIMEOUT';
            } else {
                geminiStatus = 'FORMAT_VALID_UNVERIFIED';
            }
        }

        let openAIStatus = 'NOT_CONFIGURED';
        if (openAIConfigured) {
            if (!openAIFormatValid) {
                openAIStatus = 'INVALID_CREDENTIAL_FORMAT';
            } else if (this.openAILastLiveError?.category === 'AUTH_ERROR') {
                openAIStatus = 'AUTH_FAILED';
            } else if (this.openAILiveVerified) {
                openAIStatus = 'LIVE_VERIFIED';
            } else {
                openAIStatus = 'FORMAT_VALID_UNVERIFIED';
            }
        }

        return {
            openai: {
                configured: openAIConfigured,
                formatValid: openAIFormatValid,
                liveVerified: this.openAILiveVerified,
                ready: openAIReady,
                status: openAIStatus
            },
            gemini: {
                configured: geminiConfigured,
                formatValid: geminiFormatValid,
                keysConfigured: this.uniqueGeminiKeys.length,
                keysFormatValid: validFormatKeys.length,
                keysActive: activeKeys.length,
                liveVerified: this.geminiLiveVerified,
                verifiedModel: this.geminiLiveVerified ? this.geminiLiveModel : null,
                ready: geminiReady,
                status: geminiStatus
            },
            liveAIReady,
            offlineAvailable: true,
            activeTier: liveAIReady ? (openAIReady ? 'openai' : 'gemini') : 'offline_knowledge_base'
        };
    }

    /**
     * Proactively verifies Gemini provider availability via a real minimal request.
     * Updates live readiness upon success, or sets accurate error diagnostics upon failure.
     */
    async verifyGeminiLive() {
        if (this.uniqueGeminiKeys.length === 0) {
            return { success: false, category: 'NOT_CONFIGURED', message: 'No Gemini keys configured' };
        }
        if (this.activeProbePromise) {
            return this.activeProbePromise;
        }
        this.activeProbePromise = (async () => {
            try {
                await this.cascadeGemini(["Hello"], { requestId: 'verify-live' });
                return { success: true, category: 'OK', message: 'Live request succeeded' };
            } catch (err) {
                return {
                    success: false,
                    category: err.classification?.category || 'UNKNOWN_ERROR',
                    message: err.message
                };
            }
        })().finally(() => {
            this.activeProbePromise = null;
        });
        return this.activeProbePromise;
    }

    /**
     * Executes the Gemini Cascade across keys and fallback models.
     */
    async cascadeGemini(promptParts, options = {}) {
        const { requestId = 'req', isSafetyRetry = false, streamCallback = null, timeoutMs = null } = options;
        const effectiveTimeoutMs = timeoutMs || this.requestTimeoutMs || 15000;

        if (this.uniqueGeminiKeys.length === 0) {
            throw new Error("NO_GEMINI_KEYS_CONFIGURED");
        }

        // Fast-fail if all configured keys fail format validation
        const validKeys = this.uniqueGeminiKeys.filter(k => validateGeminiCredentialFormat(k).valid);
        if (validKeys.length === 0) {
            const err = new Error("GEMINI_CREDENTIAL_FORMAT_INVALID: Configured keys do not match Google AI Studio API key format (AIza... or AQ...)");
            err.classification = { category: 'AUTH_ERROR', isPermanent: true, status: 401 };
            this.geminiLastLiveError = err.classification;
            throw err;
        }

        // Ensure transient rate-limit cooldowns never lock out all valid keys without attempting a live call
        this._releaseOldestTransientKeyIfAllCoolingDown(validKeys);

        let lastError = null;
        let lastClassification = null;

        for (let loopCount = 0; loopCount < this.uniqueGeminiKeys.length; loopCount++) {
            const currentKeyIndex = (this.globalKeyIndex + loopCount) % this.uniqueGeminiKeys.length;
            const currentKey = this.uniqueGeminiKeys[currentKeyIndex];

            // Validate format for this specific key
            const formatCheck = validateGeminiCredentialFormat(currentKey);
            if (!formatCheck.valid) {
                this.markKeyDead(currentKey, 'permanent');
                continue;
            }

            if (this.isKeyDead(currentKey)) {
                continue;
            }

            let failedAllModelsForKey = true;

            for (const modelName of this.fallbackModels) {
                const startTime = Date.now();
                try {
                    const ai = new this.GoogleGenAIClass({
                        apiKey: currentKey,
                        httpOptions: {
                            headers: {
                                'User-Agent': 'aistudio-build',
                            }
                        }
                    });
                    const safetyConfig = [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
                    ];

                    const finalPrompt = isSafetyRetry
                        ? ["**CONTEXT: PROFESSIONAL TECHNICAL INTERVIEW SIMULATION. EDUCATIONAL PURPOSE ONLY.**", ...promptParts]
                        : promptParts;

                    const attemptAbortController = new AbortController();
                    let cleanupSignal = null;
                    if (options.signal) {
                        if (options.signal.aborted) {
                            attemptAbortController.abort(options.signal.reason);
                        } else {
                            const onParentAbort = () => attemptAbortController.abort(options.signal?.reason || new Error("STREAM_CANCELLED: Request aborted by client"));
                            options.signal.addEventListener('abort', onParentAbort, { once: true });
                            cleanupSignal = () => options.signal.removeEventListener('abort', onParentAbort);
                        }
                    }

                    const callConfig = {
                        safetySettings: safetyConfig,
                        abortSignal: attemptAbortController.signal,
                        ...(modelName.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {})
                    };

                    const executeGeneration = async () => {
                        let responseText = "";
                        let responseCandidates = [];

                        // 1. Support official Google @google/genai SDK (ai.models.generateContent / generateContentStream)
                        if (ai.models && typeof ai.models.generateContent === 'function') {
                            if (streamCallback) {
                                const responseStream = await ai.models.generateContentStream({
                                    model: modelName,
                                    contents: finalPrompt,
                                    config: callConfig
                                });
                                let fullText = "";
                                let isFirst = true;
                                for await (const chunk of responseStream) {
                                    if (options.signal?.aborted || attemptAbortController.signal.aborted) {
                                        const cancelErr = new Error("STREAM_CANCELLED: Request aborted by client");
                                        cancelErr.name = "AbortError";
                                        throw cancelErr;
                                    }
                                    const chunkText = typeof chunk.text === 'function' ? chunk.text() : (chunk.text || "");
                                    fullText += chunkText;
                                    const shouldContinue = streamCallback(chunkText, isFirst);
                                    if (shouldContinue === false) {
                                        attemptAbortController.abort();
                                        break;
                                    }
                                    isFirst = false;
                                }
                                responseText = fullText;
                            } else {
                                const result = await ai.models.generateContent({
                                    model: modelName,
                                    contents: finalPrompt,
                                    config: callConfig
                                });
                                responseCandidates = result.candidates || [];
                                if (responseCandidates.length > 0 && responseCandidates[0].finishReason === "SAFETY") {
                                    logProviderAttempt({
                                        requestId, provider: 'gemini', model: modelName,
                                        keyIndex: currentKeyIndex + 1, totalKeys: this.uniqueGeminiKeys.length,
                                        status: 'SAFETY_BLOCKED', durationMs: Date.now() - startTime,
                                        errorCategory: 'SAFETY_BLOCK'
                                    });
                                    const safetyErr = new Error("SAFETY_BLOCKED");
                                    safetyErr.isSafety = true;
                                    throw safetyErr;
                                }
                                responseText = typeof result.text === 'function' ? result.text() : (result.text || "");
                            }
                        } else if (typeof ai.getGenerativeModel === 'function') {
                            // 2. Backwards-compatible legacy SDK or mock support
                            const model = ai.getGenerativeModel({
                                model: modelName,
                                safetySettings: safetyConfig
                            });
                            if (streamCallback) {
                                const result = await model.generateContentStream(finalPrompt);
                                let fullText = "";
                                let isFirst = true;
                                for await (const chunk of result.stream) {
                                    if (options.signal?.aborted || attemptAbortController.signal.aborted) {
                                        const cancelErr = new Error("STREAM_CANCELLED: Request aborted by client");
                                        cancelErr.name = "AbortError";
                                        throw cancelErr;
                                    }
                                    const chunkText = typeof chunk.text === 'function' ? chunk.text() : (chunk.text || "");
                                    fullText += chunkText;
                                    const shouldContinue = streamCallback(chunkText, isFirst);
                                    if (shouldContinue === false) {
                                        attemptAbortController.abort();
                                        break;
                                    }
                                    isFirst = false;
                                }
                                responseText = fullText;
                            } else {
                                const result = await model.generateContent(finalPrompt);
                                const response = await result.response;
                                responseCandidates = response.candidates || [];
                                if (responseCandidates.length > 0 && responseCandidates[0].finishReason === "SAFETY") {
                                    logProviderAttempt({
                                        requestId, provider: 'gemini', model: modelName,
                                        keyIndex: currentKeyIndex + 1, totalKeys: this.uniqueGeminiKeys.length,
                                        status: 'SAFETY_BLOCKED', durationMs: Date.now() - startTime,
                                        errorCategory: 'SAFETY_BLOCK'
                                    });
                                    const safetyErr = new Error("SAFETY_BLOCKED");
                                    safetyErr.isSafety = true;
                                    throw safetyErr;
                                }
                                responseText = typeof response.text === 'function' ? response.text() : (response.text || "");
                            }
                        } else {
                            throw new Error("UNSUPPORTED_GEMINI_CLIENT: Client does not expose models.generateContent or getGenerativeModel");
                        }

                        return { responseText, responseCandidates };
                    };

                    let resultData;
                    try {
                        resultData = await withTimeout(
                            executeGeneration(),
                            effectiveTimeoutMs,
                            `GEMINI_TIMEOUT [${modelName}]`,
                            attemptAbortController
                        );
                    } finally {
                        if (cleanupSignal) cleanupSignal();
                    }
                    const { responseText, responseCandidates } = resultData;

                    const durationMs = Date.now() - startTime;
                    logProviderAttempt({
                        requestId, provider: 'gemini', model: modelName,
                        keyIndex: currentKeyIndex + 1, totalKeys: this.uniqueGeminiKeys.length,
                        status: streamCallback ? 'SUCCESS_STREAM' : 'SUCCESS', durationMs
                    });

                    this.geminiLiveVerified = true;
                    this.geminiLiveModel = modelName;
                    this.geminiLastLiveError = null;
                    failedAllModelsForKey = false;
                    if (!isSafetyRetry) this.globalKeyIndex = (currentKeyIndex + 1) % this.uniqueGeminiKeys.length;

                    return {
                        response: {
                            text: () => responseText,
                            candidates: responseCandidates
                        },
                        model: modelName
                    };

                } catch (error) {
                    if (error.isSafety && !isSafetyRetry) {
                        return await this.cascadeGemini(promptParts, { ...options, isSafetyRetry: true });
                    }

                    const durationMs = Date.now() - startTime;
                    lastError = error;
                    lastClassification = classifyError(error);
                    this.geminiLastLiveError = lastClassification;

                    logProviderAttempt({
                        requestId, provider: 'gemini', model: modelName,
                        keyIndex: currentKeyIndex + 1, totalKeys: this.uniqueGeminiKeys.length,
                        status: 'FAILED', durationMs,
                        errorCategory: lastClassification.category,
                        errorMessage: error.message
                    });

                    if (lastClassification.category === 'MODEL_UNAVAILABLE') {
                        continue;
                    }

                    if (lastClassification.isPermanent) {
                        this.markKeyDead(currentKey, 'permanent');
                        failedAllModelsForKey = false;
                        break;
                    }

                    if (
                        lastClassification.category === 'QUOTA_EXHAUSTED' ||
                        lastClassification.category === 'SERVER_OVERLOAD' ||
                        lastClassification.category === 'TIMEOUT'
                    ) {
                        continue;
                    }

                    if (error.message?.includes('SAFETY') && !isSafetyRetry) {
                        return await this.cascadeGemini(promptParts, { ...options, isSafetyRetry: true });
                    }
                }
            }

            if (failedAllModelsForKey) {
                this.markKeyDead(currentKey, 'transient');
                console.log(`[${requestId}] ⚠️ Key ${currentKeyIndex + 1} exhausted across candidate models. Cooldown: ${this.transientKeyTTLMs / 1000}s`);
            }
        }

        const thrownError = new Error(`GEMINI_CASCADE_FAILED: ${lastClassification?.category || 'UNKNOWN'} - ${lastError?.message || 'All keys and models exhausted'}`);
        thrownError.classification = lastClassification;
        thrownError.originalError = lastError;
        throw thrownError;
    }

    /**
     * Generates genuine semantic embeddings for an array of text strings.
     * Supports Gemini (gemini-embedding-001 / gemini-embedding-2-preview) and OpenAI (text-embedding-3-small)
     * with key rotation, batching, and bounded timeouts. Never returns synthetic/random vectors.
     */
    async embedTexts(texts = [], options = {}) {
        const { requestId = 'embed', timeoutMs = null, batchSize = 16 } = options;
        const effectiveTimeoutMs = timeoutMs || this.requestTimeoutMs || 15000;

        if (!Array.isArray(texts) || texts.length === 0) {
            throw new Error("EMPTY_EMBEDDING_INPUT: texts must be a non-empty array of strings");
        }

        const sanitizedTexts = texts.map(t => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
        if (sanitizedTexts.length !== texts.length) {
            throw new Error("INVALID_EMBEDDING_INPUT: All items to embed must be non-empty strings");
        }

        const tryOpenAIEmbeddings = async () => {
            if (!this.openaiClient || !this.openaiClient.embeddings) {
                throw new Error("OPENAI_EMBEDDING_NOT_CONFIGURED");
            }
            const allVectors = [];
            const startTime = Date.now();
            for (let i = 0; i < sanitizedTexts.length; i += batchSize) {
                const batch = sanitizedTexts.slice(i, i + batchSize);
                const res = await withTimeout(
                    this.openaiClient.embeddings.create({
                        model: this.openAIEmbeddingModel,
                        input: batch
                    }),
                    effectiveTimeoutMs,
                    `OPENAI_EMBED_TIMEOUT [${this.openAIEmbeddingModel}]`
                );
                const sorted = (res.data || []).sort((a, b) => a.index - b.index);
                for (const item of sorted) {
                    if (Array.isArray(item.embedding)) {
                        allVectors.push(item.embedding);
                    }
                }
            }
            if (allVectors.length !== sanitizedTexts.length) {
                throw new Error("OPENAI_EMBEDDING_COUNT_MISMATCH");
            }
            logProviderAttempt({
                requestId, provider: 'openai-embed', model: this.openAIEmbeddingModel,
                status: 'SUCCESS', durationMs: Date.now() - startTime
            });
            return {
                embeddings: allVectors,
                provider: 'openai',
                model: this.openAIEmbeddingModel
            };
        };

        const tryGeminiEmbeddings = async () => {
            if (this.uniqueGeminiKeys.length === 0) {
                throw new Error("NO_GEMINI_KEYS_CONFIGURED");
            }
            const validKeys = this.uniqueGeminiKeys.filter(k => validateGeminiCredentialFormat(k).valid);
            if (validKeys.length === 0) {
                throw new Error("GEMINI_CREDENTIAL_FORMAT_INVALID");
            }

            this._releaseOldestTransientKeyIfAllCoolingDown(validKeys);

            let lastError = null;
            for (let loopCount = 0; loopCount < this.uniqueGeminiKeys.length; loopCount++) {
                const currentKeyIndex = (this.globalKeyIndex + loopCount) % this.uniqueGeminiKeys.length;
                const currentKey = this.uniqueGeminiKeys[currentKeyIndex];
                if (!validateGeminiCredentialFormat(currentKey).valid) {
                    this.markKeyDead(currentKey, 'permanent');
                    continue;
                }
                if (this.isKeyDead(currentKey)) {
                    continue;
                }

                let failedAllEmbedModelsForKey = true;

                for (const embedModel of this.geminiEmbeddingModels) {
                    const startTime = Date.now();
                    try {
                        const ai = new this.GoogleGenAIClass({
                            apiKey: currentKey,
                            httpOptions: {
                                headers: { 'User-Agent': 'aistudio-build' }
                            }
                        });

                        const embedSingleBatch = async (batch) => {
                            if (ai.models && typeof ai.models.embedContent === 'function') {
                                const res = await ai.models.embedContent({
                                    model: embedModel,
                                    contents: batch
                                });
                                const vectors = (res.embeddings || [])
                                    .map(e => e?.values || e?.embedding || (Array.isArray(e) ? e : null))
                                    .filter(Array.isArray);

                                if (vectors.length === batch.length) {
                                    return vectors;
                                }
                                // If model treated multi-string contents as 1 multimodal item (e.g. gemini-embedding-2-preview),
                                // embed each item in the batch individually in parallel
                                if (batch.length > 1 && vectors.length === 1) {
                                    const individualResults = await Promise.all(
                                        batch.map(async (singleText) => {
                                            const singleRes = await ai.models.embedContent({
                                                model: embedModel,
                                                contents: [singleText]
                                            });
                                            const v = singleRes.embeddings?.[0]?.values || singleRes.embeddings?.[0]?.embedding;
                                            if (!Array.isArray(v)) throw new Error("Missing vector in individual embedContent");
                                            return v;
                                        })
                                    );
                                    return individualResults;
                                }
                                throw new Error(`Unexpected embedding count: got ${vectors.length}, expected ${batch.length}`);
                            } else if (typeof ai.getGenerativeModel === 'function') {
                                const model = ai.getGenerativeModel({ model: embedModel });
                                if (typeof model.embedContent !== 'function') {
                                    throw new Error("Legacy client does not implement embedContent");
                                }
                                const results = await Promise.all(
                                    batch.map(async (singleText) => {
                                        const r = await model.embedContent(singleText);
                                        return r?.embedding?.values || r?.embedding;
                                    })
                                );
                                return results;
                            } else {
                                throw new Error("Client does not expose models.embedContent");
                            }
                        };

                        const allVectors = [];
                        for (let i = 0; i < sanitizedTexts.length; i += batchSize) {
                            const batch = sanitizedTexts.slice(i, i + batchSize);
                            const batchVectors = await withTimeout(
                                embedSingleBatch(batch),
                                effectiveTimeoutMs,
                                `GEMINI_EMBED_TIMEOUT [${embedModel}]`
                            );
                            allVectors.push(...batchVectors);
                        }

                        logProviderAttempt({
                            requestId, provider: 'gemini-embed', model: embedModel,
                            keyIndex: currentKeyIndex + 1, totalKeys: this.uniqueGeminiKeys.length,
                            status: 'SUCCESS', durationMs: Date.now() - startTime
                        });

                        failedAllEmbedModelsForKey = false;
                        this.globalKeyIndex = (currentKeyIndex + 1) % this.uniqueGeminiKeys.length;
                        return {
                            embeddings: allVectors,
                            provider: 'gemini',
                            model: embedModel
                        };
                    } catch (err) {
                        lastError = err;
                        const classification = classifyError(err);
                        logProviderAttempt({
                            requestId, provider: 'gemini-embed', model: embedModel,
                            keyIndex: currentKeyIndex + 1, totalKeys: this.uniqueGeminiKeys.length,
                            status: 'FAILED', durationMs: Date.now() - startTime,
                            errorCategory: classification.category,
                            errorMessage: err.message
                        });
                        if (classification.isPermanent) {
                            this.markKeyDead(currentKey, 'permanent');
                            failedAllEmbedModelsForKey = false;
                            break;
                        }
                    }
                }

                if (failedAllEmbedModelsForKey) {
                    this.markKeyDead(currentKey, 'transient');
                }
            }

            throw lastError || new Error("GEMINI_EMBEDDING_CASCADE_EXHAUSTED");
        };

        if (this.embeddingProvider === 'openai') {
            return await tryOpenAIEmbeddings();
        }
        if (this.embeddingProvider === 'gemini') {
            return await tryGeminiEmbeddings();
        }

        // 'auto': Prefer Gemini if keys are configured (matches primary 3072-d space), else OpenAI
        const errors = [];
        if (this.uniqueGeminiKeys.length > 0) {
            try {
                return await tryGeminiEmbeddings();
            } catch (e) {
                errors.push(`Gemini: ${e.message}`);
            }
        }
        if (this.openaiClient) {
            try {
                return await tryOpenAIEmbeddings();
            } catch (e) {
                errors.push(`OpenAI: ${e.message}`);
            }
        }

        const err = new Error(`EMBEDDING_CASCADE_FAILED: ${errors.join(' | ') || 'No embedding providers configured'}`);
        err.code = 'EMBEDDING_PROVIDER_UNAVAILABLE';
        throw err;
    }

    /**
     * Unified 3-Tier Provider Flow:
     * Tier 1 (OpenAI) -> Tier 2 (Gemini Cascade) -> Tier 3 (FastEngine Offline)
     * Preserves RAG retrieved context across provider failovers.
     */
    async generateAnswer(transcript = "", image = null, session = {}, requestId = 'req', streamCallback = null, options = {}) {
        const { signal = null, timeoutMs = null, ragContext = null } = (typeof options === 'object' && options !== null) ? options : {};
        const hasRetrievedChunks = Array.isArray(ragContext?.chunks) && ragContext.chunks.length > 0;
        const ragSources = hasRetrievedChunks ? (ragContext.sources || []) : [];

        const diagnostics = {
            tier1_openai: { attempted: false, success: false, error: null, model: this.openAIModel },
            tier2_gemini: { attempted: false, success: false, error: null, model: null },
            tier3_offline: { attempted: false, success: false, model: 'knowledge_engine' },
            rag: {
                status: ragContext?.status || 'NONE',
                chunksRetrieved: hasRetrievedChunks ? ragContext.chunks.length : 0,
                grounded: false
            }
        };

        const {
            role = "Software Engineer",
            company = "Tech Company",
            tone = "Professional",
            detailLevel = "Concise"
        } = session?.settings || {};

        // Build unified prompt (grounded in retrieved RAG chunks if available, else legacy session context)
        const groundedPrompt = hasRetrievedChunks
            ? buildGroundedRAGPrompt({
                question: transcript,
                retrievedChunks: ragContext.chunks,
                role,
                company,
                tone,
                detailLevel,
                hasVisualContext: Boolean(image)
            })
            : null;

        // --- TIER 1: OpenAI ---
        if (this.openaiClient && !image) {
            diagnostics.tier1_openai.attempted = true;
            const startTime = Date.now();
            try {
                const messages = groundedPrompt
                    ? [
                        { role: "system", content: "You are an expert interview copilot. Follow all grounding and security rules strictly." },
                        { role: "user", content: groundedPrompt }
                    ]
                    : [
                        { role: "system", content: "You are an expert technical interviewer. Provide a concise answer." },
                        { role: "user", content: transcript }
                    ];

                // OpenAI SDK v4 request options (timeout passed as second argument)
                const completion = await this.openaiClient.chat.completions.create(
                    {
                        messages,
                        model: this.openAIModel
                    },
                    { timeout: 12000 }
                );
                const text = completion.choices[0]?.message?.content || "";
                const durationMs = Date.now() - startTime;
                logProviderAttempt({
                    requestId, provider: 'openai', model: this.openAIModel,
                    status: 'SUCCESS', durationMs
                });
                diagnostics.tier1_openai.success = true;
                diagnostics.rag.grounded = hasRetrievedChunks;
                this.openAILiveVerified = true;
                this.openAILastLiveError = null;
                return {
                    text,
                    provider: 'openai',
                    model: this.openAIModel,
                    isOffline: false,
                    grounded: hasRetrievedChunks,
                    ragSources,
                    diagnostics
                };
            } catch (err) {
                const durationMs = Date.now() - startTime;
                const classification = classifyError(err);
                this.openAILastLiveError = classification;
                logProviderAttempt({
                    requestId, provider: 'openai', model: this.openAIModel,
                    status: 'FAILED', durationMs,
                    errorCategory: classification.category,
                    errorMessage: err.message
                });
                diagnostics.tier1_openai.error = { category: classification.category, message: err.message };
                // Recoverable failover to Tier 2 (RAG groundedPrompt is preserved!)
            }
        }

        // --- TIER 2: Gemini Cascade ---
        if (this.uniqueGeminiKeys.length > 0) {
            diagnostics.tier2_gemini.attempted = true;
            try {
                let promptParts;
                if (groundedPrompt) {
                    promptParts = [groundedPrompt];
                    if (image) {
                        const base64Data = image.split(',')[1] || image;
                        promptParts.push({ inlineData: { data: base64Data, mimeType: "image/jpeg" } });
                    }
                } else {
                    const resumeSnippet = session.resume ? `\nCANDIDATE RESUME: "${session.resume.substring(0, 5000)}"` : "";
                    promptParts = [
                        `Act as a Senior ${role} interviewing at ${company}. Speak as the candidate. Direct, clear, technical depth.${resumeSnippet}`
                    ];

                    if (image) {
                        const base64Data = image.split(',')[1] || image;
                        promptParts.push({ inlineData: { data: base64Data, mimeType: "image/jpeg" } });
                    }

                    if (transcript) {
                        promptParts.push(`\nQUESTION / SPEECH: "${transcript}"`);
                    } else {
                        promptParts.push(`\nQUESTION: Analyze the visual code / diagram from screen.`);
                    }
                }

                const result = await this.cascadeGemini(promptParts, { requestId, streamCallback, signal, timeoutMs });
                const response = await result.response;
                const text = typeof response.text === 'function' ? response.text() : (response.text || "");

                diagnostics.tier2_gemini.success = true;
                diagnostics.tier2_gemini.model = result.model;
                diagnostics.rag.grounded = hasRetrievedChunks;
                return {
                    text,
                    provider: 'gemini',
                    isOffline: false,
                    model: result.model,
                    grounded: hasRetrievedChunks,
                    ragSources,
                    diagnostics
                };
            } catch (err) {
                diagnostics.tier2_gemini.error = {
                    category: err.classification?.category || 'CASCADE_EXHAUSTED',
                    message: err.message
                };
                // Fall through to Tier 3
            }
        }

        // --- TIER 3: Offline Fallback ---
        // Note: Offline fallback answers are NEVER claimed to be grounded in retrieved documents.
        diagnostics.tier3_offline.attempted = true;
        diagnostics.tier3_offline.success = true;
        diagnostics.rag.grounded = false;
        const offlineText = FastEngine.generateAnswer(transcript);
        logProviderAttempt({
            requestId, provider: 'offline', model: 'knowledge_engine',
            status: 'FALLBACK_SERVED', durationMs: 0
        });

        return {
            text: offlineText,
            provider: 'offline',
            model: 'knowledge_engine',
            isOffline: true,
            grounded: false,
            ragSources: [],
            diagnostics
        };
    }
}
