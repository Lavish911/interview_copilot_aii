import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// =============================================================================
// CANONICAL MODELS CONFIGURATION
// =============================================================================

export const CANONICAL_GEMINI_MODELS = Object.freeze([
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-pro"
]);

export const CANONICAL_OPENAI_MODEL = "gpt-4o-mini";

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
    if (cleanKey.startsWith('AQ.')) {
        return {
            valid: false,
            status: 'INVALID_FORMAT_OAUTH_TOKEN',
            reason: 'OAuth/Vertex token format starting with AQ. is unsupported by Google AI Studio API'
        };
    }
    if (!cleanKey.startsWith('AIza')) {
        return {
            valid: false,
            status: 'INVALID_FORMAT',
            reason: 'Google AI Studio API keys must start with "AIza"'
        };
    }
    return { valid: true, status: 'FORMAT_VALID', reason: 'Conforms to Google AI Studio API key format' };
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

    if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ESOCKETTIMEDOUT')) {
        return { category: 'TIMEOUT', isPermanent: false, status: 408 };
    }

    if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        return { category: 'NETWORK_ERROR', isPermanent: false, status: 502 };
    }

    return { category: 'UNKNOWN_ERROR', isPermanent: false, status: status || 500 };
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
        this.GoogleGenerativeAIClass = config.GoogleGenerativeAIClass || GoogleGenerativeAI;

        this.fallbackModels = config.fallbackModels || CANONICAL_GEMINI_MODELS;
        this.openAIModel = config.openAIModel || CANONICAL_OPENAI_MODEL;

        this.deadKeyTTLMs = config.deadKeyTTLMs || (5 * 60 * 1000); // 5 minutes
        this.deadKeyTimestamps = new Map();
        this.globalKeyIndex = 0;

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
        this.openAILastLiveError = null;
        this.geminiLastLiveError = null;
    }

    isKeyDead(key) {
        const timestamp = this.deadKeyTimestamps.get(key);
        if (!timestamp) return false;
        if (Date.now() - timestamp > this.deadKeyTTLMs) {
            this.deadKeyTimestamps.delete(key);
            console.log(`🔄 Key TTL expired — returned to active pool.`);
            return false;
        }
        return true;
    }

    markKeyDead(key) {
        this.deadKeyTimestamps.set(key, Date.now());
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
                const hasOAuth = this.uniqueGeminiKeys.some(k => k.startsWith('AQ.'));
                geminiStatus = hasOAuth ? 'INVALID_FORMAT_OAUTH_TOKEN' : 'INVALID_CREDENTIAL_FORMAT';
            } else if (activeKeys.length === 0) {
                geminiStatus = 'ALL_KEYS_EXHAUSTED_COOLDOWN';
            } else if (this.geminiLastLiveError?.category === 'AUTH_ERROR') {
                geminiStatus = 'AUTH_FAILED';
            } else if (this.geminiLiveVerified) {
                geminiStatus = 'LIVE_VERIFIED';
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
                ready: geminiReady,
                status: geminiStatus
            },
            liveAIReady,
            offlineAvailable: true,
            activeTier: liveAIReady ? (openAIReady ? 'openai' : 'gemini') : 'offline_knowledge_base'
        };
    }

    /**
     * Executes the Gemini Cascade across keys and fallback models.
     */
    async cascadeGemini(promptParts, options = {}) {
        const { requestId = 'req', isSafetyRetry = false, streamCallback = null } = options;

        if (this.uniqueGeminiKeys.length === 0) {
            throw new Error("NO_GEMINI_KEYS_CONFIGURED");
        }

        // Fast-fail if all configured keys fail format validation
        const validKeys = this.uniqueGeminiKeys.filter(k => validateGeminiCredentialFormat(k).valid);
        if (validKeys.length === 0) {
            const err = new Error("GEMINI_CREDENTIAL_FORMAT_INVALID: Configured keys do not match Google AI Studio API key format (AIzaSy...)");
            err.classification = { category: 'AUTH_ERROR', isPermanent: true, status: 401 };
            this.geminiLastLiveError = err.classification;
            throw err;
        }

        let lastError = null;
        let lastClassification = null;

        for (let loopCount = 0; loopCount < this.uniqueGeminiKeys.length; loopCount++) {
            const currentKeyIndex = (this.globalKeyIndex + loopCount) % this.uniqueGeminiKeys.length;
            const currentKey = this.uniqueGeminiKeys[currentKeyIndex];

            // Validate format for this specific key
            const formatCheck = validateGeminiCredentialFormat(currentKey);
            if (!formatCheck.valid) {
                this.markKeyDead(currentKey);
                continue;
            }

            if (this.isKeyDead(currentKey)) {
                continue;
            }

            let failedAllModelsForKey = true;

            for (const modelName of this.fallbackModels) {
                const startTime = Date.now();
                try {
                    const genAI = new this.GoogleGenerativeAIClass(currentKey);
                    const model = genAI.getGenerativeModel({
                        model: modelName,
                        safetySettings: [
                            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
                        ]
                    });

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
                        const durationMs = Date.now() - startTime;
                        logProviderAttempt({
                            requestId, provider: 'gemini', model: modelName,
                            keyIndex: currentKeyIndex + 1, totalKeys: this.uniqueGeminiKeys.length,
                            status: 'SUCCESS_STREAM', durationMs
                        });

                        this.geminiLiveVerified = true;
                        this.geminiLastLiveError = null;
                        if (!isSafetyRetry) this.globalKeyIndex = (currentKeyIndex + 1) % this.uniqueGeminiKeys.length;
                        return { response: { text: () => fullText }, model: modelName };
                    } else {
                        const result = await model.generateContent(finalPrompt);
                        const response = await result.response;
                        const durationMs = Date.now() - startTime;

                        if (response.candidates && response.candidates.length > 0 && response.candidates[0].finishReason === "SAFETY") {
                            logProviderAttempt({
                                requestId, provider: 'gemini', model: modelName,
                                keyIndex: currentKeyIndex + 1, totalKeys: this.uniqueGeminiKeys.length,
                                status: 'SAFETY_BLOCKED', durationMs,
                                errorCategory: 'SAFETY_BLOCK'
                            });
                            if (!isSafetyRetry) {
                                return await this.cascadeGemini(promptParts, { ...options, isSafetyRetry: true });
                            }
                            throw new Error("SAFETY_BLOCKED");
                        }

                        logProviderAttempt({
                            requestId, provider: 'gemini', model: modelName,
                            keyIndex: currentKeyIndex + 1, totalKeys: this.uniqueGeminiKeys.length,
                            status: 'SUCCESS', durationMs
                        });

                        this.geminiLiveVerified = true;
                        this.geminiLastLiveError = null;
                        if (!isSafetyRetry) this.globalKeyIndex = (currentKeyIndex + 1) % this.uniqueGeminiKeys.length;
                        return { response, model: modelName };
                    }

                } catch (error) {
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
                        this.markKeyDead(currentKey);
                        failedAllModelsForKey = false;
                        break;
                    }

                    if (lastClassification.category === 'QUOTA_EXHAUSTED' || lastClassification.category === 'SERVER_OVERLOAD') {
                        continue;
                    }

                    if (error.message?.includes('SAFETY') && !isSafetyRetry) {
                        return await this.cascadeGemini(promptParts, { ...options, isSafetyRetry: true });
                    }
                }
            }

            if (failedAllModelsForKey) {
                this.markKeyDead(currentKey);
                console.log(`[${requestId}] ⚠️ Key ${currentKeyIndex + 1} exhausted across candidate models. Cooldown: ${this.deadKeyTTLMs / 1000}s`);
            }
        }

        const thrownError = new Error(`GEMINI_CASCADE_FAILED: ${lastClassification?.category || 'UNKNOWN'} - ${lastError?.message || 'All keys and models exhausted'}`);
        thrownError.classification = lastClassification;
        thrownError.originalError = lastError;
        throw thrownError;
    }

    /**
     * Unified 3-Tier Provider Flow:
     * Tier 1 (OpenAI) -> Tier 2 (Gemini Cascade) -> Tier 3 (FastEngine Offline)
     */
    async generateAnswer(transcript = "", image = null, session = {}, requestId = 'req', streamCallback = null) {
        const diagnostics = {
            tier1_openai: { attempted: false, success: false, error: null },
            tier2_gemini: { attempted: false, success: false, error: null, model: null },
            tier3_offline: { attempted: false, success: false }
        };

        // --- TIER 1: OpenAI ---
        if (this.openaiClient && !image) {
            diagnostics.tier1_openai.attempted = true;
            const startTime = Date.now();
            try {
                // OpenAI SDK v4 request options (timeout passed as second argument)
                const completion = await this.openaiClient.chat.completions.create(
                    {
                        messages: [
                            { role: "system", content: "You are an expert technical interviewer. Provide a concise answer." },
                            { role: "user", content: transcript }
                        ],
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
                this.openAILiveVerified = true;
                this.openAILastLiveError = null;
                return { text, provider: 'openai', isOffline: false, diagnostics };
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
                // Recoverable failover to Tier 2
            }
        }

        // --- TIER 2: Gemini Cascade ---
        if (this.uniqueGeminiKeys.length > 0) {
            diagnostics.tier2_gemini.attempted = true;
            try {
                const { role = "Software Engineer", company = "Tech Company" } = session.settings || {};
                const resumeSnippet = session.resume ? `\nCANDIDATE RESUME: "${session.resume.substring(0, 5000)}"` : "";

                const promptParts = [
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

                const result = await this.cascadeGemini(promptParts, { requestId, streamCallback });
                const response = await result.response;
                const text = response.text();

                diagnostics.tier2_gemini.success = true;
                diagnostics.tier2_gemini.model = result.model;
                return { text, provider: 'gemini', isOffline: false, model: result.model, diagnostics };
            } catch (err) {
                diagnostics.tier2_gemini.error = {
                    category: err.classification?.category || 'CASCADE_EXHAUSTED',
                    message: err.message
                };
                // Fall through to Tier 3
            }
        }

        // --- TIER 3: Offline Fallback ---
        diagnostics.tier3_offline.attempted = true;
        diagnostics.tier3_offline.success = true;
        const offlineText = FastEngine.generateAnswer(transcript);
        logProviderAttempt({
            requestId, provider: 'offline', model: 'knowledge_engine',
            status: 'FALLBACK_SERVED', durationMs: 0
        });

        return {
            text: offlineText,
            provider: 'offline',
            isOffline: true,
            diagnostics
        };
    }
}
