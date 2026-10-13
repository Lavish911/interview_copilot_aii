import {
    AIEngine,
    classifyError,
    getOpaqueKeyLabel,
    validateGeminiCredentialFormat,
    validateOpenAICredentialFormat,
    FastEngine
} from '../server/ai_engine.js';

console.log("==================================================");
console.log("🧪 Running Deterministic AI Engine Unit & Mock Tests");
console.log("==================================================\n");

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`✅ [PASS] ${testName}`);
        passedCount++;
    } else {
        console.error(`❌ [FAIL] ${testName}`);
        failedCount++;
    }
}

// -----------------------------------------------------------------------------
// SYNTHETIC MOCK CLIENT DEFINITIONS (NO REAL CREDENTIALS)
// -----------------------------------------------------------------------------

const SYNTHETIC_GEMINI_KEY_VALID_1 = "AIzaSy_SYNTHETIC_MOCK_GEMINI_KEY_ALPHA_001";
const SYNTHETIC_GEMINI_KEY_VALID_2 = "AIzaSy_SYNTHETIC_MOCK_GEMINI_KEY_BETA_002";
const SYNTHETIC_GEMINI_KEY_AUTH = "AQ.Ab8RN_SYNTHETIC_AUTHORIZATION_KEY_TEST_ONLY_12345";
const SYNTHETIC_OPENAI_KEY_VALID = "sk-proj-SYNTHETIC_MOCK_OPENAI_KEY_FOR_TESTS_ONLY";

class MockOpenAISuccess {
    constructor() {
        this.chat = {
            completions: {
                create: async () => ({
                    choices: [{ message: { content: "Mock OpenAI Response" } }]
                })
            }
        };
    }
}

class MockOpenAIFail {
    constructor() {
        this.chat = {
            completions: {
                create: async () => {
                    const err = new Error("OpenAI quota exceeded");
                    err.status = 429;
                    throw err;
                }
            }
        };
    }
}

class MockGeminiLegacySuccess {
    constructor() {}
    getGenerativeModel({ model }) {
        return {
            generateContent: async () => ({
                response: {
                    text: () => `Mock Gemini legacy response from model ${model}`,
                    candidates: [{ finishReason: "STOP" }]
                }
            }),
            generateContentStream: async () => ({
                stream: (async function* () {
                    yield { text: () => "Mock " };
                    yield { text: () => "Stream " };
                    yield { text: () => "Gemini" };
                })()
            })
        };
    }
}

class MockGoogleGenAISuccess {
    constructor() {
        this.models = {
            generateContent: async ({ model }) => ({
                text: `Mock @google/genai response from model ${model}`,
                candidates: [{ finishReason: "STOP" }]
            }),
            generateContentStream: async function* () {
                yield { text: "Mock " };
                yield { text: "Stream " };
                yield { text: "@google/genai" };
            }
        };
    }
}

class MockGeminiAuthError {
    constructor() {}
    getGenerativeModel() {
        return {
            generateContent: async () => {
                const err = new Error("[401 Unauthorized] ACCESS_TOKEN_TYPE_UNSUPPORTED");
                err.status = 401;
                throw err;
            }
        };
    }
}

class MockGeminiHangingGeneration {
    constructor() {
        this.models = {
            generateContent: async () => {
                await new Promise(r => setTimeout(r, 150));
                return { text: "Too late" };
            }
        };
    }
}

class MockGeminiHangingStream {
    constructor() {
        this.models = {
            generateContent: async () => ({ text: "Stub" }),
            generateContentStream: async function* () {
                yield { text: "First chunk" };
                await new Promise(r => setTimeout(r, 150));
                yield { text: "Second chunk" };
            }
        };
    }
}

// -----------------------------------------------------------------------------
// TEST SUITE EXECUTION
// -----------------------------------------------------------------------------

async function runUnitTests() {
    // 1-4d. Error Classification Tests
    console.log("--- Category 1: Error Classification ---");
    const err401 = classifyError(new Error("[401 Unauthorized] ACCESS_TOKEN_TYPE_UNSUPPORTED"));
    assert(err401.category === 'AUTH_ERROR' && err401.isPermanent === true, "1. Classifies 401 ACCESS_TOKEN_TYPE_UNSUPPORTED as permanent AUTH_ERROR");

    const err429 = classifyError(new Error("429 RESOURCE_EXHAUSTED"));
    assert(err429.category === 'QUOTA_EXHAUSTED' && err429.isPermanent === false, "2. Classifies 429 RESOURCE_EXHAUSTED as retryable QUOTA_EXHAUSTED");

    const err404 = classifyError(new Error("models/xyz is not found 404"));
    assert(err404.category === 'MODEL_UNAVAILABLE' && err404.isPermanent === false, "3. Classifies 404 as MODEL_UNAVAILABLE");

    const err503 = classifyError(new Error("503 The model is overloaded"));
    assert(err503.category === 'SERVER_OVERLOAD' && err503.isPermanent === false, "4. Classifies 503 as SERVER_OVERLOAD");

    const errTimeout = classifyError(new Error("Operation timed out after 15000ms"));
    assert(errTimeout.category === 'TIMEOUT' && errTimeout.isPermanent === false && errTimeout.status === 408, "4b. Classifies timeout message as retryable TIMEOUT with status 408");

    const errTimeoutObj = classifyError({ name: 'TimeoutError', message: 'Request timed out' });
    assert(errTimeoutObj.category === 'TIMEOUT' && errTimeoutObj.status === 408, "4c. Classifies TimeoutError object as TIMEOUT");

    const errSocketTimeout = classifyError(new Error("ESOCKETTIMEDOUT"));
    assert(errSocketTimeout.category === 'TIMEOUT' && errSocketTimeout.status === 408, "4d. Classifies ESOCKETTIMEDOUT as TIMEOUT");

    // 5. Opaque Key Labeling
    console.log("\n--- Category 2: Sensitive Logging & Opaque Labels ---");
    const label = getOpaqueKeyLabel(1, 5);
    assert(label === "key_1_of_5" && !label.includes("AIza") && !label.includes("AQ."), "5. Generates opaque key labels without leaking key fragments (key_1_of_5)");

    // 6-9c. Gemini Credential Format Validation
    console.log("\n--- Category 3: Gemini Credential Format Validation ---");
    const geminiAbsent = validateGeminiCredentialFormat("");
    assert(geminiAbsent.valid === false && geminiAbsent.status === 'NOT_CONFIGURED', "6. Validates absent Gemini key as NOT_CONFIGURED (valid: false)");

    const geminiPlaceholder = validateGeminiCredentialFormat("your_gemini_api_key_here");
    assert(geminiPlaceholder.valid === false && geminiPlaceholder.status === 'PLACEHOLDER', "7. Validates placeholder Gemini key as PLACEHOLDER (valid: false)");

    const geminiAuthKey = validateGeminiCredentialFormat(SYNTHETIC_GEMINI_KEY_AUTH);
    assert(
        geminiAuthKey.valid === true &&
        geminiAuthKey.status === 'FORMAT_VALID' &&
        geminiAuthKey.keyType === 'AUTHORIZATION_KEY',
        "8. Validates AQ. authorization key format as FORMAT_VALID (valid: true, keyType: AUTHORIZATION_KEY)"
    );

    const geminiInvalidPrefix = validateGeminiCredentialFormat("unknown_prefix_credential_format_12345");
    assert(geminiInvalidPrefix.valid === false && geminiInvalidPrefix.status === 'INVALID_FORMAT', "8b. Rejects unknown key prefix as INVALID_FORMAT (valid: false)");

    const geminiInvalidChars = validateGeminiCredentialFormat("AQ.validLengthButWithInvalid Spaces And $ymbols!");
    assert(geminiInvalidChars.valid === false && geminiInvalidChars.status === 'INVALID_CHARACTERS', "8c. Rejects credentials with illegal characters (valid: false)");

    const geminiValid = validateGeminiCredentialFormat(SYNTHETIC_GEMINI_KEY_VALID_1);
    assert(geminiValid.valid === true && geminiValid.status === 'FORMAT_VALID' && geminiValid.keyType === 'STANDARD_KEY', "9. Validates synthetic AIzaSy key format as FORMAT_VALID (valid: true, keyType: STANDARD_KEY)");

    // 10-12. OpenAI Credential Format Validation
    console.log("\n--- Category 4: OpenAI Credential Format Validation ---");
    const openaiAbsent = validateOpenAICredentialFormat("");
    assert(openaiAbsent.valid === false && openaiAbsent.status === 'NOT_CONFIGURED', "10. Validates absent OpenAI key as NOT_CONFIGURED (valid: false)");

    const openaiInvalid = validateOpenAICredentialFormat("invalid_non_sk_key_string_here");
    assert(openaiInvalid.valid === false && openaiInvalid.status === 'INVALID_FORMAT', "11. Validates non-sk OpenAI key as INVALID_FORMAT (valid: false)");

    const openaiValid = validateOpenAICredentialFormat(SYNTHETIC_OPENAI_KEY_VALID);
    assert(openaiValid.valid === true && openaiValid.status === 'FORMAT_VALID', "12. Validates synthetic sk- key format as FORMAT_VALID (valid: true)");

    // 13-14b. Readiness Reporting Truthfulness
    console.log("\n--- Category 5: Readiness Truthfulness ---");
    const unverifiedEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_VALID_1]
    });
    const unverifiedHealth = unverifiedEngine.getProviderHealth();
    assert(
        unverifiedHealth.gemini.status === 'FORMAT_VALID_UNVERIFIED' &&
        unverifiedHealth.gemini.liveVerified === false &&
        unverifiedHealth.liveAIReady === false,
        "13. Format-valid Gemini provider before live network call reports FORMAT_VALID_UNVERIFIED and liveAIReady: false"
    );

    const authKeyEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_AUTH]
    });
    const authKeyHealth = authKeyEngine.getProviderHealth();
    assert(
        authKeyHealth.gemini.formatValid === true &&
        authKeyHealth.gemini.ready === false &&
        authKeyHealth.gemini.status === 'FORMAT_VALID_UNVERIFIED' &&
        authKeyHealth.gemini.liveVerified === false &&
        authKeyHealth.liveAIReady === false,
        "14. AQ. authorization key before live network call reports FORMAT_VALID_UNVERIFIED and ready: false"
    );

    const authErrorEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_AUTH],
        GoogleGenAIClass: class {
            constructor() {
                this.models = {
                    generateContent: async () => {
                        const err = new Error("[401 Unauthorized] ACCESS_TOKEN_TYPE_UNSUPPORTED");
                        err.status = 401;
                        throw err;
                    }
                };
            }
        }
    });
    await authErrorEngine.generateAnswer("Explain Event Loop");
    const authErrorHealth = authErrorEngine.getProviderHealth();
    assert(
        authErrorHealth.gemini.ready === false &&
        authErrorHealth.gemini.status === 'AUTH_FAILED' &&
        authErrorHealth.gemini.liveVerified === false &&
        authErrorHealth.liveAIReady === false,
        "14b. AQ. key encountering 401 live auth error transitions to AUTH_FAILED and remains ready: false"
    );

    // 15-18b. Deterministic Mock Engine Executions
    console.log("\n--- Category 6: Deterministic Mock Engine Executions ---");
    const legacyEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_VALID_1],
        GoogleGenerativeAIClass: MockGeminiLegacySuccess
    });
    const legacyRes = await legacyEngine.generateAnswer("Explain Virtual DOM");
    assert(legacyRes.provider === 'gemini' && legacyRes.isOffline === false, "15. Deterministic Mock: Backwards-compatible legacy client returns live response");

    const genAIEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_AUTH],
        GoogleGenAIClass: MockGoogleGenAISuccess
    });
    const genAIRes = await genAIEngine.generateAnswer("Explain Fiber Architecture");
    const genAIHealth = genAIEngine.getProviderHealth();
    assert(
        genAIRes.provider === 'gemini' &&
        genAIHealth.gemini.liveVerified === true &&
        genAIHealth.gemini.status === 'LIVE_VERIFIED' &&
        genAIHealth.gemini.ready === true,
        "15b. Deterministic Mock: Native @google/genai client with AQ. key verifies live-ready upon success"
    );

    const failoverEngine = new AIEngine({
        openAIKey: SYNTHETIC_OPENAI_KEY_VALID,
        geminiKeys: [SYNTHETIC_GEMINI_KEY_VALID_1],
        OpenAIClientClass: MockOpenAIFail,
        GoogleGenAIClass: MockGoogleGenAISuccess
    });
    const failoverRes = await failoverEngine.generateAnswer("Explain SQL Indexes");
    assert(failoverRes.provider === 'gemini' && failoverRes.diagnostics.tier1_openai.attempted === true, "16. Deterministic Mock: OpenAI-to-Gemini Failover with synthetic keys");

    const authFailEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_VALID_1],
        GoogleGenerativeAIClass: MockGeminiAuthError
    });
    const authFailRes = await authFailEngine.generateAnswer("Explain Event Loop");
    assert(authFailRes.provider === 'offline' && authFailEngine.isKeyDead(SYNTHETIC_GEMINI_KEY_VALID_1) === true, "17. Deterministic Mock: Permanent auth failure marks key dead and falls back safely to FastEngine");

    let cascadeCallCount = 0;
    class MockCascadeGenAI {
        constructor({ apiKey }) {
            this.apiKey = apiKey;
        }
        get models() {
            cascadeCallCount++;
            return {
                generateContent: async () => {
                    if (this.apiKey === SYNTHETIC_GEMINI_KEY_VALID_1) {
                        const err = new Error("429 Too Many Requests");
                        err.status = 429;
                        throw err;
                    }
                    return {
                        text: "Key 2 succeeded after Key 1 was rate limited",
                        candidates: [{ finishReason: "STOP" }]
                    };
                }
            };
        }
    }
    const cascadeEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_VALID_1, SYNTHETIC_GEMINI_KEY_VALID_2],
        GoogleGenAIClass: MockCascadeGenAI
    });
    const cascadeRes = await cascadeEngine.generateAnswer("System design");
    assert(cascadeRes.provider === 'gemini' && cascadeRes.text.includes("Key 2 succeeded"), "18. Deterministic Mock: Quota Exhaustion & Cascade across @google/genai keys");

    // 19. Circuit Breaker TTL Recovery
    console.log("\n--- Category 7: Circuit Breaker TTL Recovery ---");
    const ttlEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_VALID_1],
        deadKeyTTLMs: 40
    });
    ttlEngine.markKeyDead(SYNTHETIC_GEMINI_KEY_VALID_1);
    const initiallyDead = ttlEngine.isKeyDead(SYNTHETIC_GEMINI_KEY_VALID_1);
    await new Promise(r => setTimeout(r, 55));
    const recoveredAfterTTL = !ttlEngine.isKeyDead(SYNTHETIC_GEMINI_KEY_VALID_1);
    assert(initiallyDead && recoveredAfterTTL, "19. Circuit Breaker TTL Recovery Test restores dead key after TTL expiration");

    // 20-22. Timeout Classification, Circuit-Breaker & Fallback
    console.log("\n--- Category 8: Timeout Classification, Circuit-Breaker & Fallback ---");
    const timeoutEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_AUTH],
        requestTimeoutMs: 30,
        fallbackModels: ['gemini-2.5-flash'],
        GoogleGenAIClass: MockGeminiHangingGeneration
    });
    const timeoutRes = await timeoutEngine.generateAnswer("Explain Virtual DOM");
    const timeoutHealth = timeoutEngine.getProviderHealth();
    assert(
        timeoutRes.provider === 'offline' &&
        timeoutRes.isOffline === true &&
        timeoutRes.diagnostics.tier2_gemini.error?.category === 'TIMEOUT',
        "20. Bounded Timeout: Hanging generateContent request times out and falls back to FastEngine"
    );
    assert(
        timeoutHealth.liveAIReady === false &&
        timeoutHealth.gemini.ready === false &&
        timeoutHealth.gemini.liveVerified === false &&
        (timeoutHealth.gemini.status === 'ALL_KEYS_EXHAUSTED_COOLDOWN' || timeoutHealth.gemini.status === 'TIMEOUT') &&
        timeoutEngine.isKeyDead(SYNTHETIC_GEMINI_KEY_AUTH) === true,
        "21. Bounded Timeout Circuit-Breaker: Key timing out across candidate models is placed in cooldown and never marked LIVE_READY"
    );

    const streamTimeoutEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_AUTH],
        requestTimeoutMs: 30,
        fallbackModels: ['gemini-2.5-flash'],
        GoogleGenAIClass: MockGeminiHangingStream
    });
    let streamFailed = false;
    try {
        await streamTimeoutEngine.cascadeGemini(["Explain Event Loop"], { streamCallback: () => {}, timeoutMs: 30 });
    } catch (e) {
        streamFailed = e.classification?.category === 'TIMEOUT' || classifyError(e).category === 'TIMEOUT';
    }
    assert(streamFailed === true, "22. Bounded Timeout: Hanging streaming request times out cleanly without hanging");

    // 23. Diagnostic Output & Model Attribution Truthfulness
    console.log("\n--- Category 9: Diagnostic Output & Model Attribution ---");
    const liveSuccessEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_AUTH],
        GoogleGenAIClass: MockGoogleGenAISuccess
    });
    const liveRes = await liveSuccessEngine.generateAnswer("Explain React Reconciliation");
    const liveHealth = liveSuccessEngine.getProviderHealth();
    assert(
        liveRes.provider === 'gemini' &&
        liveRes.model === 'gemini-2.5-flash' &&
        liveHealth.gemini.liveVerified === true &&
        liveHealth.gemini.verifiedModel === 'gemini-2.5-flash' &&
        liveRes.diagnostics.tier2_gemini.model === 'gemini-2.5-flash' &&
        !JSON.stringify(liveRes.diagnostics).includes(SYNTHETIC_GEMINI_KEY_AUTH) &&
        !JSON.stringify(liveHealth).includes(SYNTHETIC_GEMINI_KEY_AUTH),
        "23. Diagnostics & Health record active model and do not expose credentials or personal data"
    );

    // 24. Stream Cancellation
    let streamChunksReceived = 0;
    const cancelEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_AUTH],
        GoogleGenAIClass: MockGoogleGenAISuccess
    });
    const cancelRes = await cancelEngine.generateAnswer(
        "Explain Closures",
        null,
        {},
        'req-cancel',
        (chunk) => {
            streamChunksReceived++;
            return false; // Consumer cancels stream on first chunk
        }
    );
    assert(
        streamChunksReceived === 1 && cancelRes.provider === 'gemini',
        "24. Stream Cancellation: Returning false from streamCallback cancels stream iteration promptly"
    );

    // 25. Startup Probe Behavior
    const probeEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_AUTH],
        GoogleGenAIClass: MockGoogleGenAISuccess
    });
    const probeResult = await probeEngine.verifyGeminiLive();
    assert(
        probeResult.success === true &&
        probeResult.category === 'OK' &&
        probeEngine.getProviderHealth().gemini.status === 'LIVE_VERIFIED',
        "25. Startup Probe: verifyGeminiLive validates provider and sets LIVE_VERIFIED without credentials leak"
    );

    console.log("\n==================================================");
    console.log(`Unit Test Summary: ${passedCount} passed, ${failedCount} failed.`);
    console.log("==================================================");

    if (failedCount > 0 || passedCount === 0) {
        process.exit(1);
    }
}

runUnitTests().catch(e => {
    console.error("Fatal unit test error:", e);
    process.exit(1);
});
