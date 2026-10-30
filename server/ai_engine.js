import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { buildGroundedRAGPrompt } from './rag_engine.js';

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

const SPEECH_PHRASE_CORRECTIONS = [
    [/\b(we act|re act|reacts|react j s|react js)\b/gi, "React"],
    [/\b(virtual dorm|virtual don|virtual d o m)\b/gi, "Virtual DOM"],
    [/\b(you state|used state|use state)\b/gi, "useState"],
    [/\b(used effect|user fact|use effect)\b/gi, "useEffect"],
    [/\b(type script|tight script|typescripts)\b/gi, "TypeScript"],
    [/\b(java script|javascripts)\b/gi, "JavaScript"],
    [/\b(notes js|note js|no js|node j s|know js)\b/gi, "Node.js"],
    [/\b(even loop|event luke)\b/gi, "Event Loop"],
    [/\b(rest a p i|rest api|breast api|west api)\b/gi, "REST API"],
    [/\b(graph q l|graph ql|giraffe ql)\b/gi, "GraphQL"],
    [/\b(no sequel|no s q l)\b/gi, "NoSQL"],
    [/\b(post grass|post gress|post gres|postgres q l)\b/gi, "PostgreSQL"],
    [/\b(s q l|sequel)\b/gi, "SQL"],
    [/\b(mongo db|mongo tv|mango db)\b/gi, "MongoDB"],
    [/\b(red is|read is|reddish)\b/gi, "Redis"],
    [/\b(cooper net is|cooper netties|kuber netis|cuban it is|k 8 s)\b/gi, "Kubernetes"],
    [/\b(micro service|micro services)\b/gi, "microservices"],
    [/\b(sister design|system designed)\b/gi, "system design"],
    [/\b(a sink|a synchronous)\b/gi, "async"],
    [/\b(close sure)\b/gi, "closure"],
    [/\b(cashing)\b/gi, "caching"],
    [/\b(ci cd|c i c d|see i see d)\b/gi, "CI/CD"]
];

export function normalizeSpeechQuery(rawText = "") {
    if (!rawText || typeof rawText !== "string") return "";
    let text = rawText.trim();
    if (!text) return "";
    text = text.replace(/^(?:(?:um+|uh+|hmm+|er+|ah+|oh+|like|you know|i mean|so yeah|okay so|alright so|well|so)[,\s]+)+/i, "").trim();
    for (const [pattern, replacement] of SPEECH_PHRASE_CORRECTIONS) {
        text = text.replace(pattern, replacement);
    }
    if (/\b(redis|database|memory|server|browser|cdn|api|query|data|hit|miss|layer|invalidat|ttl|store|system|design|scale|latency)\b/i.test(text)) {
        text = text.replace(/\bcash\b/gi, "cache");
    }
    return text.replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1").replace(/\s+/g, " ").trim();
}

export const KNOWLEDGE_BASE = {
    "react": "In my day-to-day React work, I focus on keeping components predictable and renders fast. React uses a Virtual DOM and its Fiber reconciliation engine to diff state changes in memory and prioritize urgent UI updates—like user input—before committing minimal changes to the real DOM.\n\nWhen I'm building features, I rely on hooks like `useState` and `useEffect` for local state and side effects, and I reach for `useMemo` or `useCallback` only when profiling shows expensive recalculations or unnecessary child re-renders.",
    "css": "When I'm laying out interfaces in CSS, I usually combine CSS Grid for the macro 2D page structure with Flexbox for 1D alignment inside components. I stick to a mobile-first approach using fluid units like `rem` and `clamp()`, and keep specificity flat so styles stay easy to maintain across the team.",
    "performance": "Whenever I optimize web performance, I start by measuring Core Web Vitals—specifically LCP for loading speed, INP for responsiveness, and CLS for visual stability. On the frontend, I get the biggest wins from route-level code splitting, virtualizing long lists, and serving compressed `avif` or `webp` assets through a CDN. On the backend, adding Redis caching and trimming payload sizes usually drops p99 latency right away.",
    "node": "What makes Node.js great for I/O-heavy services is its single-threaded Event Loop powered by libuv. Instead of blocking a thread on database queries or network calls, Node delegates those operations asynchronously and handles thousands of concurrent connections with very low memory overhead. If I ever have CPU-heavy work, I offload it to Worker Threads or a background queue so the main event loop stays responsive.",
    "database": "When choosing between SQL and NoSQL, I look at consistency requirements and access patterns first. For transactional data and clear relationships, I prefer PostgreSQL because ACID guarantees and B-Tree indexing keep data integrity rock-solid. When I need ultra-fast key-value lookups, session state, or rate limiting, I pair it with Redis or a horizontally sharded NoSQL store.",
    "api": "When designing APIs, I focus on clean contracts, idempotency, and predictable error handling. For most CRUD and resource workflows, I build stateless REST APIs with cursor-based pagination and strict input validation. If the frontend needs real-time bi-directional updates—like live streaming or notifications—I use WebSockets or Socket.IO instead of heavy polling.",
    "dsa": "When I approach an algorithmic problem, I always clarify constraints and edge cases first, then start with a clean working approach before optimizing time and space complexity. In practice, trading a bit of memory for a Hash Map or Set often brings an O(n²) nested lookup down to O(n), while BFS and DFS are my go-to patterns for graph and tree traversal.",
    "closure": "A closure in JavaScript happens when a function remembers and accesses variables from its outer lexical scope even after that outer function has finished running. I use closures all the time for data encapsulation, factory functions, and debouncers—just making sure to clean up event listeners or timers so long-lived closures don't hold onto memory unnecessarily.",
    "async": "In JavaScript, `async/await` is syntactic sugar over Promises that lets us write non-blocking asynchronous code that reads like synchronous logic. When I need to run independent network calls in parallel, I wrap them in `Promise.all()` or `Promise.allSettled()` rather than awaiting them one by one in a loop.",
    "system design": "When I design a scalable system, I start by estimating read-to-write ratios, throughput, and latency targets. From there, I place stateless application servers behind a load balancer, add a Redis caching layer to absorb hot reads, and partition the database with read replicas or sharding. To keep the system resilient in production, I always include rate limiting, circuit breakers, and idempotent retries.",
    "tell me about yourself": "I'm a software engineer who loves building fast, reliable full-stack applications from end to end. Over my recent projects, I've focused on designing clean React frontends and scalable Node.js and cloud backends, with a strong emphasis on real-world performance and developer experience.\n\nRight now, I'm excited about this role because I enjoy solving high-impact engineering challenges with a collaborative team, and my hands-on experience maps directly to what you're building.",
    "weakness": "Earlier on, I sometimes caught myself spending too much time polishing edge-case architecture before getting early feedback on the core feature. Over the past year, I've become much more intentional about scoping a clean MVP first, shipping iteratively, and letting real metrics guide where we optimize next.",
    "default": "The way I approach this in practice is by breaking the problem down into clear, maintainable pieces: first making sure the core data flow and edge cases are solid, and then optimizing for performance, scalability, and clean code."
};

export const FastEngine = {
    generateAnswer: (transcript = "") => {
        const t = normalizeSpeechQuery(transcript).toLowerCase();
        let bestMatch = "default";
        let highestScore = 0;

        for (const key of Object.keys(KNOWLEDGE_BASE)) {
            if (key === "default") continue;
            let score = t.includes(key) ? 2 : 0;
            for (const w of key.split(' ')) {
                if (t.includes(w)) score += 1;
            }
            if (score > highestScore) {
                highestScore = score;
                bestMatch = key;
            }
        }

        if (/(about yourself|introduce yourself|walk me through your resume|your background|who are you)/i.test(t)) return KNOWLEDGE_BASE["tell me about yourself"];
        if (highestScore === 0) {
            if (/(sql|postgres|mongo|redis|nosql|index|query|sharding)/i.test(t)) return KNOWLEDGE_BASE["database"];
            if (/(hook|virtual dom|fiber|usestate|useeffect|jsx|redux|frontend)/i.test(t)) return KNOWLEDGE_BASE["react"];
            if (/(event loop|express|stream|libuv|backend)/i.test(t)) return KNOWLEDGE_BASE["node"];
            if (/(scale|load balancer|microservice|cap theorem|rate limit|distributed|cache|caching)/i.test(t)) return KNOWLEDGE_BASE["system design"];
        }

        if (highestScore > 0) return KNOWLEDGE_BASE[bestMatch];
        if (t.includes("hello") || t.includes("hi")) return "Hey! Glad to be chatting with you today—I'm ready whenever you want to dive into technical or behavioral questions.";
        if (t.includes("thank")) return "Of course, happy to walk through that! Let me know what we should dive into next.";
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

export function validateGeminiCredentialFormat(key) {
    if (!key || typeof key !== 'string' || !key.trim()) {
        return { valid: false, status: 'NOT_CONFIGURED', reason: 'Key is absent' };
    }
    const cleanKey = key.trim();
    if (cleanKey.includes('your_') || cleanKey.includes('placeholder') || cleanKey.length < 25) {
        return { valid: false, status: 'PLACEHOLDER', reason: 'Placeholder key detected' };
    }

    const isLegacyKey = cleanKey.startsWith('AIza');
    const isAuthKey = cleanKey.startsWith('AQ.');
    if (!isLegacyKey && !isAuthKey) {
        return {
            valid: false,
            status: 'INVALID_FORMAT',
            reason: 'Gemini API credentials must start with "AIza" (standard key) or "AQ." (authorization key)'
        };
    }

    if (!/^[A-Za-z0-9_.-]+$/.test(cleanKey)) {
        return { valid: false, status: 'INVALID_CHARACTERS', reason: 'Gemini credential contains invalid characters' };
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
    if (!key || typeof key !== 'string' || !key.trim()) {
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

    if (status === 429 || msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
        return { category: 'QUOTA_EXHAUSTED', isPermanent: false, status: status || 429 };
    }

    if (status === 404 || msg.includes('404') || msg.includes('not found') || msg.includes('is not supported for generateContent')) {
        return { category: 'MODEL_UNAVAILABLE', isPermanent: false, status: status || 404 };
    }

    if (status === 503 || msg.includes('503') || msg.includes('Overloaded') || msg.includes('Service Unavailable')) {
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
                try { abortController.abort(err); } catch { /* ignore */ }
            }
            reject(err);
        }, timeoutMs);
    });
    return Promise.race([promise.finally(() => clearTimeout(timeoutId)), timeoutPromise]);
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

const SAFETY_CONFIG = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
];

export class AIEngine {
    constructor(config = {}) {
        this.openAIKey = config.openAIKey || null;
        this.geminiKeys = config.geminiKeys || [];
        this.OpenAIClientClass = config.OpenAIClientClass || OpenAI;
        this.GoogleGenAIClass = config.GoogleGenAIClass || config.GoogleGenerativeAIClass || GoogleGenAI;
        this.GoogleGenerativeAIClass = this.GoogleGenAIClass;

        this.fallbackModels = config.fallbackModels || CANONICAL_GEMINI_MODELS;
        this.openAIModel = config.openAIModel || CANONICAL_OPENAI_MODEL;
        this.geminiEmbeddingModels = config.geminiEmbeddingModels || CANONICAL_GEMINI_EMBEDDING_MODELS;
        this.openAIEmbeddingModel = config.openAIEmbeddingModel || CANONICAL_OPENAI_EMBEDDING_MODEL;
        this.embeddingProvider = (config.embeddingProvider || process.env.RAG_EMBEDDING_PROVIDER || 'auto').toLowerCase();

        this.deadKeyTTLMs = config.deadKeyTTLMs || (5 * 60 * 1000);
        this.transientKeyTTLMs = config.deadKeyTTLMs || config.transientKeyTTLMs || (15 * 1000);
        this.deadKeyTimestamps = new Map();
        this.deadKeyReasons = new Map();
        this.globalKeyIndex = 0;
        this.requestTimeoutMs = config.requestTimeoutMs || 15000;

        this.openAIValidation = validateOpenAICredentialFormat(this.openAIKey);
        this.openaiClient = null;
        if (this.openAIValidation.valid) {
            try {
                this.openaiClient = new this.OpenAIClientClass({ apiKey: this.openAIKey });
            } catch (err) {
                console.warn("⚠️ Failed to initialize OpenAI client:", err.message);
            }
        }

        this.uniqueGeminiKeys = [...new Set(this.geminiKeys.filter(k => typeof k === 'string' && k.trim().length > 0))];
        this.geminiValidations = this.uniqueGeminiKeys.map(k => validateGeminiCredentialFormat(k));

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
        const ttl = (this.deadKeyReasons.get(key) || 'permanent') === 'transient' ? this.transientKeyTTLMs : this.deadKeyTTLMs;
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

    getProviderHealth() {
        const validFormatKeys = this.uniqueGeminiKeys.filter(k => validateGeminiCredentialFormat(k).valid);
        const activeKeys = validFormatKeys.filter(k => !this.isKeyDead(k));

        const openAIConfigured = Boolean(this.openAIKey && this.openAIKey.length > 0);
        const openAIFormatValid = this.openAIValidation.valid;
        const openAIReady = openAIFormatValid && this.openAILiveVerified;

        const geminiConfigured = this.uniqueGeminiKeys.length > 0;
        const geminiFormatValid = validFormatKeys.length > 0;
        const geminiReady = geminiFormatValid && activeKeys.length > 0 && this.geminiLiveVerified;
        const liveAIReady = openAIReady || geminiReady;

        let geminiStatus = 'NOT_CONFIGURED';
        if (geminiConfigured) {
            if (!geminiFormatValid) geminiStatus = 'INVALID_CREDENTIAL_FORMAT';
            else if (this.geminiLastLiveError?.category === 'AUTH_ERROR') geminiStatus = 'AUTH_FAILED';
            else if (activeKeys.length === 0) geminiStatus = 'ALL_KEYS_EXHAUSTED_COOLDOWN';
            else if (this.geminiLiveVerified) geminiStatus = 'LIVE_VERIFIED';
            else if (this.geminiLastLiveError?.category === 'TIMEOUT') geminiStatus = 'TIMEOUT';
            else geminiStatus = 'FORMAT_VALID_UNVERIFIED';
        }

        let openAIStatus = 'NOT_CONFIGURED';
        if (openAIConfigured) {
            if (!openAIFormatValid) openAIStatus = 'INVALID_CREDENTIAL_FORMAT';
            else if (this.openAILastLiveError?.category === 'AUTH_ERROR') openAIStatus = 'AUTH_FAILED';
            else if (this.openAILiveVerified) openAIStatus = 'LIVE_VERIFIED';
            else openAIStatus = 'FORMAT_VALID_UNVERIFIED';
        }

        return {
            openai: { configured: openAIConfigured, formatValid: openAIFormatValid, liveVerified: this.openAILiveVerified, ready: openAIReady, status: openAIStatus },
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

    async verifyGeminiLive() {
        if (this.uniqueGeminiKeys.length === 0) {
            return { success: false, category: 'NOT_CONFIGURED', message: 'No Gemini keys configured' };
        }
        if (this.activeProbePromise) return this.activeProbePromise;
        this.activeProbePromise = (async () => {
            try {
                await this.cascadeGemini(["Hello"], { requestId: 'verify-live' });
                return { success: true, category: 'OK', message: 'Live request succeeded' };
            } catch (err) {
                return { success: false, category: err.classification?.category || 'UNKNOWN_ERROR', message: err.message };
            }
        })().finally(() => {
            this.activeProbePromise = null;
        });
        return this.activeProbePromise;
    }

    async cascadeGemini(promptParts, options = {}) {
        const { requestId = 'req', isSafetyRetry = false, streamCallback = null, timeoutMs = null } = options;
        const effectiveTimeoutMs = timeoutMs || this.requestTimeoutMs || 15000;

        if (this.uniqueGeminiKeys.length === 0) throw new Error("NO_GEMINI_KEYS_CONFIGURED");

        const validKeys = this.uniqueGeminiKeys.filter(k => validateGeminiCredentialFormat(k).valid);
        if (validKeys.length === 0) {
            const err = new Error("GEMINI_CREDENTIAL_FORMAT_INVALID: Configured keys do not match Google AI Studio API key format (AIza... or AQ...)");
            err.classification = { category: 'AUTH_ERROR', isPermanent: true, status: 401 };
            this.geminiLastLiveError = err.classification;
            throw err;
        }

        this._releaseOldestTransientKeyIfAllCoolingDown(validKeys);

        let lastError = null;
        let lastClassification = null;

        const consumeStream = async (iterable, attemptAbortController) => {
            let fullText = "";
            let isFirst = true;
            for await (const chunk of iterable) {
                if (options.signal?.aborted || attemptAbortController.signal.aborted) {
                    const cancelErr = new Error("STREAM_CANCELLED: Request aborted by client");
                    cancelErr.name = "AbortError";
                    throw cancelErr;
                }
                const chunkText = typeof chunk.text === 'function' ? chunk.text() : (chunk.text || "");
                fullText += chunkText;
                if (streamCallback(chunkText, isFirst) === false) {
                    attemptAbortController.abort();
                    break;
                }
                isFirst = false;
            }
            return fullText;
        };

        for (let loopCount = 0; loopCount < this.uniqueGeminiKeys.length; loopCount++) {
            const currentKeyIndex = (this.globalKeyIndex + loopCount) % this.uniqueGeminiKeys.length;
            const currentKey = this.uniqueGeminiKeys[currentKeyIndex];

            if (!validateGeminiCredentialFormat(currentKey).valid) {
                this.markKeyDead(currentKey, 'permanent');
                continue;
            }
            if (this.isKeyDead(currentKey)) continue;

            let failedAllModelsForKey = true;

            for (const modelName of this.fallbackModels) {
                const startTime = Date.now();
                try {
                    const ai = new this.GoogleGenAIClass({
                        apiKey: currentKey,
                        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
                    });

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
                        safetySettings: SAFETY_CONFIG,
                        abortSignal: attemptAbortController.signal,
                        ...(modelName.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {})
                    };

                    const checkSafetyCandidate = (candidates) => {
                        if (candidates.length > 0 && candidates[0].finishReason === "SAFETY") {
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
                    };

                    const executeGeneration = async () => {
                        let responseText = "";
                        let responseCandidates = [];

                        if (ai.models && typeof ai.models.generateContent === 'function') {
                            if (streamCallback) {
                                const stream = await ai.models.generateContentStream({ model: modelName, contents: finalPrompt, config: callConfig });
                                responseText = await consumeStream(stream, attemptAbortController);
                            } else {
                                const result = await ai.models.generateContent({ model: modelName, contents: finalPrompt, config: callConfig });
                                responseCandidates = result.candidates || [];
                                checkSafetyCandidate(responseCandidates);
                                responseText = typeof result.text === 'function' ? result.text() : (result.text || "");
                            }
                        } else if (typeof ai.getGenerativeModel === 'function') {
                            const model = ai.getGenerativeModel({ model: modelName, safetySettings: SAFETY_CONFIG });
                            if (streamCallback) {
                                const result = await model.generateContentStream(finalPrompt);
                                responseText = await consumeStream(result.stream, attemptAbortController);
                            } else {
                                const result = await model.generateContent(finalPrompt);
                                const response = await result.response;
                                responseCandidates = response.candidates || [];
                                checkSafetyCandidate(responseCandidates);
                                responseText = typeof response.text === 'function' ? response.text() : (response.text || "");
                            }
                        } else {
                            throw new Error("UNSUPPORTED_GEMINI_CLIENT: Client does not expose models.generateContent or getGenerativeModel");
                        }

                        return { responseText, responseCandidates };
                    };

                    let resultData;
                    try {
                        resultData = await withTimeout(executeGeneration(), effectiveTimeoutMs, `GEMINI_TIMEOUT [${modelName}]`, attemptAbortController);
                    } finally {
                        if (cleanupSignal) cleanupSignal();
                    }

                    logProviderAttempt({
                        requestId, provider: 'gemini', model: modelName,
                        keyIndex: currentKeyIndex + 1, totalKeys: this.uniqueGeminiKeys.length,
                        status: streamCallback ? 'SUCCESS_STREAM' : 'SUCCESS', durationMs: Date.now() - startTime
                    });

                    this.geminiLiveVerified = true;
                    this.geminiLiveModel = modelName;
                    this.geminiLastLiveError = null;
                    failedAllModelsForKey = false;
                    if (!isSafetyRetry) this.globalKeyIndex = (currentKeyIndex + 1) % this.uniqueGeminiKeys.length;

                    return {
                        response: { text: () => resultData.responseText, candidates: resultData.responseCandidates },
                        model: modelName
                    };
                } catch (error) {
                    if (error.isSafety && !isSafetyRetry) {
                        return await this.cascadeGemini(promptParts, { ...options, isSafetyRetry: true });
                    }

                    lastError = error;
                    lastClassification = classifyError(error);
                    this.geminiLastLiveError = lastClassification;

                    logProviderAttempt({
                        requestId, provider: 'gemini', model: modelName,
                        keyIndex: currentKeyIndex + 1, totalKeys: this.uniqueGeminiKeys.length,
                        status: 'FAILED', durationMs: Date.now() - startTime,
                        errorCategory: lastClassification.category,
                        errorMessage: error.message
                    });

                    if (lastClassification.category === 'MODEL_UNAVAILABLE') continue;
                    if (lastClassification.isPermanent) {
                        this.markKeyDead(currentKey, 'permanent');
                        failedAllModelsForKey = false;
                        break;
                    }
                    if (['QUOTA_EXHAUSTED', 'SERVER_OVERLOAD', 'TIMEOUT'].includes(lastClassification.category)) continue;
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
            if (!this.openaiClient || !this.openaiClient.embeddings) throw new Error("OPENAI_EMBEDDING_NOT_CONFIGURED");
            const allVectors = [];
            const startTime = Date.now();
            for (let i = 0; i < sanitizedTexts.length; i += batchSize) {
                const batch = sanitizedTexts.slice(i, i + batchSize);
                const res = await withTimeout(
                    this.openaiClient.embeddings.create({ model: this.openAIEmbeddingModel, input: batch }),
                    effectiveTimeoutMs,
                    `OPENAI_EMBED_TIMEOUT [${this.openAIEmbeddingModel}]`
                );
                for (const item of (res.data || []).sort((a, b) => a.index - b.index)) {
                    if (Array.isArray(item.embedding)) allVectors.push(item.embedding);
                }
            }
            if (allVectors.length !== sanitizedTexts.length) throw new Error("OPENAI_EMBEDDING_COUNT_MISMATCH");
            logProviderAttempt({ requestId, provider: 'openai-embed', model: this.openAIEmbeddingModel, status: 'SUCCESS', durationMs: Date.now() - startTime });
            return { embeddings: allVectors, provider: 'openai', model: this.openAIEmbeddingModel };
        };

        const tryGeminiEmbeddings = async () => {
            if (this.uniqueGeminiKeys.length === 0) throw new Error("NO_GEMINI_KEYS_CONFIGURED");
            const validKeys = this.uniqueGeminiKeys.filter(k => validateGeminiCredentialFormat(k).valid);
            if (validKeys.length === 0) throw new Error("GEMINI_CREDENTIAL_FORMAT_INVALID");

            this._releaseOldestTransientKeyIfAllCoolingDown(validKeys);

            let lastError = null;
            for (let loopCount = 0; loopCount < this.uniqueGeminiKeys.length; loopCount++) {
                const currentKeyIndex = (this.globalKeyIndex + loopCount) % this.uniqueGeminiKeys.length;
                const currentKey = this.uniqueGeminiKeys[currentKeyIndex];
                if (!validateGeminiCredentialFormat(currentKey).valid) {
                    this.markKeyDead(currentKey, 'permanent');
                    continue;
                }
                if (this.isKeyDead(currentKey)) continue;

                let failedAllEmbedModelsForKey = true;

                for (const embedModel of this.geminiEmbeddingModels) {
                    const startTime = Date.now();
                    try {
                        const ai = new this.GoogleGenAIClass({
                            apiKey: currentKey,
                            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
                        });

                        const embedSingleBatch = async (batch) => {
                            if (ai.models && typeof ai.models.embedContent === 'function') {
                                const res = await ai.models.embedContent({ model: embedModel, contents: batch });
                                const vectors = (res.embeddings || [])
                                    .map(e => e?.values || e?.embedding || (Array.isArray(e) ? e : null))
                                    .filter(Array.isArray);

                                if (vectors.length === batch.length) return vectors;
                                if (batch.length > 1 && vectors.length === 1) {
                                    return await Promise.all(
                                        batch.map(async (singleText) => {
                                            const singleRes = await ai.models.embedContent({ model: embedModel, contents: [singleText] });
                                            const v = singleRes.embeddings?.[0]?.values || singleRes.embeddings?.[0]?.embedding;
                                            if (!Array.isArray(v)) throw new Error("Missing vector in individual embedContent");
                                            return v;
                                        })
                                    );
                                }
                                throw new Error(`Unexpected embedding count: got ${vectors.length}, expected ${batch.length}`);
                            } else if (typeof ai.getGenerativeModel === 'function') {
                                const model = ai.getGenerativeModel({ model: embedModel });
                                if (typeof model.embedContent !== 'function') throw new Error("Legacy client does not implement embedContent");
                                return await Promise.all(
                                    batch.map(async (singleText) => {
                                        const r = await model.embedContent(singleText);
                                        return r?.embedding?.values || r?.embedding;
                                    })
                                );
                            }
                            throw new Error("Client does not expose models.embedContent");
                        };

                        const allVectors = [];
                        for (let i = 0; i < sanitizedTexts.length; i += batchSize) {
                            const batch = sanitizedTexts.slice(i, i + batchSize);
                            const batchVectors = await withTimeout(embedSingleBatch(batch), effectiveTimeoutMs, `GEMINI_EMBED_TIMEOUT [${embedModel}]`);
                            allVectors.push(...batchVectors);
                        }

                        logProviderAttempt({
                            requestId, provider: 'gemini-embed', model: embedModel,
                            keyIndex: currentKeyIndex + 1, totalKeys: this.uniqueGeminiKeys.length,
                            status: 'SUCCESS', durationMs: Date.now() - startTime
                        });

                        failedAllEmbedModelsForKey = false;
                        this.globalKeyIndex = (currentKeyIndex + 1) % this.uniqueGeminiKeys.length;
                        return { embeddings: allVectors, provider: 'gemini', model: embedModel };
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

                if (failedAllEmbedModelsForKey) this.markKeyDead(currentKey, 'transient');
            }

            throw lastError || new Error("GEMINI_EMBEDDING_CASCADE_EXHAUSTED");
        };

        if (this.embeddingProvider === 'openai') return await tryOpenAIEmbeddings();
        if (this.embeddingProvider === 'gemini') return await tryGeminiEmbeddings();

        const errors = [];
        if (this.uniqueGeminiKeys.length > 0) {
            try { return await tryGeminiEmbeddings(); } catch (e) { errors.push(`Gemini: ${e.message}`); }
        }
        if (this.openaiClient) {
            try { return await tryOpenAIEmbeddings(); } catch (e) { errors.push(`OpenAI: ${e.message}`); }
        }

        const err = new Error(`EMBEDDING_CASCADE_FAILED: ${errors.join(' | ') || 'No embedding providers configured'}`);
        err.code = 'EMBEDDING_PROVIDER_UNAVAILABLE';
        throw err;
    }

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

        const cleanedTranscript = normalizeSpeechQuery(transcript || "");

        const groundedPrompt = hasRetrievedChunks
            ? buildGroundedRAGPrompt({
                question: cleanedTranscript || transcript,
                retrievedChunks: ragContext.chunks,
                role,
                company,
                tone,
                detailLevel,
                hasVisualContext: Boolean(image)
            })
            : null;

        const humanizedSystemInstruction = `You are a real human candidate interviewing live for a ${role} role at ${company}.
Tone: ${tone}, ${detailLevel}.
Rules:
1. Speak naturally in first-person ("I", "my", "in my experience") as if talking directly to the interviewer in a real conversation.
2. Never use robotic AI openings ("Certainly!", "Great question!", "Here is an answer:") or stiff textbook headers ("### Introduction", "Present / Past / Future").
3. The input comes from live microphone speech-to-text and may contain misheard words or homophones—infer the intended ${role} interview question and answer it directly and naturally.`;

        if (this.openaiClient && !image) {
            diagnostics.tier1_openai.attempted = true;
            const startTime = Date.now();
            try {
                const messages = groundedPrompt
                    ? [
                        { role: "system", content: "You are a real human candidate in a live interview. Follow all grounding, security, and natural spoken style rules strictly." },
                        { role: "user", content: groundedPrompt }
                    ]
                    : [
                        { role: "system", content: humanizedSystemInstruction },
                        { role: "user", content: cleanedTranscript || transcript }
                    ];

                const completion = await this.openaiClient.chat.completions.create(
                    { messages, model: this.openAIModel },
                    { timeout: 12000 }
                );
                const text = completion.choices[0]?.message?.content || "";
                logProviderAttempt({ requestId, provider: 'openai', model: this.openAIModel, status: 'SUCCESS', durationMs: Date.now() - startTime });
                diagnostics.tier1_openai.success = true;
                diagnostics.rag.grounded = hasRetrievedChunks;
                this.openAILiveVerified = true;
                this.openAILastLiveError = null;
                return { text, provider: 'openai', model: this.openAIModel, isOffline: false, grounded: hasRetrievedChunks, ragSources, diagnostics };
            } catch (err) {
                const classification = classifyError(err);
                this.openAILastLiveError = classification;
                logProviderAttempt({
                    requestId, provider: 'openai', model: this.openAIModel,
                    status: 'FAILED', durationMs: Date.now() - startTime,
                    errorCategory: classification.category, errorMessage: err.message
                });
                diagnostics.tier1_openai.error = { category: classification.category, message: err.message };
            }
        }

        if (this.uniqueGeminiKeys.length > 0) {
            diagnostics.tier2_gemini.attempted = true;
            try {
                let promptParts;
                if (groundedPrompt) {
                    promptParts = [groundedPrompt];
                    if (image) promptParts.push({ inlineData: { data: image.split(',')[1] || image, mimeType: "image/jpeg" } });
                } else {
                    const resumeSnippet = session.resume ? `\nCANDIDATE RESUME CONTEXT:\n"${session.resume.substring(0, 5000)}"` : "";
                    promptParts = [`${humanizedSystemInstruction}${resumeSnippet}`];
                    if (image) promptParts.push({ inlineData: { data: image.split(',')[1] || image, mimeType: "image/jpeg" } });
                    promptParts.push(
                        (cleanedTranscript || transcript)
                            ? `\nINTERVIEW QUESTION (from live mic speech): "${cleanedTranscript || transcript}"`
                            : `\nINTERVIEW QUESTION: Walk through the visual code or diagram on screen naturally in first person.`
                    );
                }

                const result = await this.cascadeGemini(promptParts, { requestId, streamCallback, signal, timeoutMs });
                const response = await result.response;
                const text = typeof response.text === 'function' ? response.text() : (response.text || "");

                diagnostics.tier2_gemini.success = true;
                diagnostics.tier2_gemini.model = result.model;
                diagnostics.rag.grounded = hasRetrievedChunks;
                return { text, provider: 'gemini', isOffline: false, model: result.model, grounded: hasRetrievedChunks, ragSources, diagnostics };
            } catch (err) {
                diagnostics.tier2_gemini.error = {
                    category: err.classification?.category || 'CASCADE_EXHAUSTED',
                    message: err.message
                };
            }
        }

        diagnostics.tier3_offline.attempted = true;
        diagnostics.tier3_offline.success = true;
        diagnostics.rag.grounded = false;
        const offlineText = FastEngine.generateAnswer(transcript);
        logProviderAttempt({ requestId, provider: 'offline', model: 'knowledge_engine', status: 'FALLBACK_SERVED', durationMs: 0 });

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
