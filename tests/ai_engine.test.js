import {
    AIEngine,
    classifyError,
    getOpaqueKeyLabel,
    validateGeminiCredentialFormat,
    validateOpenAICredentialFormat,
    FastEngine
} from '../server/ai_engine.js';

console.log("==================================================");
console.log("🧪 Running 19 Deterministic AI Engine Unit & Mock Tests");
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
const SYNTHETIC_GEMINI_KEY_OAUTH = "AQ.Ab8RN_SYNTHETIC_OAUTH_TOKEN_TEST_ONLY";
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

class MockGeminiSuccess {
    constructor() {}
    getGenerativeModel({ model }) {
        return {
            generateContent: async () => ({
                response: {
                    text: () => `Mock Gemini response from model ${model}`,
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

// -----------------------------------------------------------------------------
// TEST SUITE EXECUTION
// -----------------------------------------------------------------------------

async function runUnitTests() {
    // 1-4. Error Classification Tests
    console.log("--- Category 1: Error Classification ---");
    const err401 = classifyError(new Error("[401 Unauthorized] ACCESS_TOKEN_TYPE_UNSUPPORTED"));
    assert(err401.category === 'AUTH_ERROR' && err401.isPermanent === true, "1. Classifies 401 ACCESS_TOKEN_TYPE_UNSUPPORTED as permanent AUTH_ERROR");

    const err429 = classifyError(new Error("429 RESOURCE_EXHAUSTED"));
    assert(err429.category === 'QUOTA_EXHAUSTED' && err429.isPermanent === false, "2. Classifies 429 RESOURCE_EXHAUSTED as retryable QUOTA_EXHAUSTED");

    const err404 = classifyError(new Error("models/xyz is not found 404"));
    assert(err404.category === 'MODEL_UNAVAILABLE' && err404.isPermanent === false, "3. Classifies 404 as MODEL_UNAVAILABLE");

    const err503 = classifyError(new Error("503 The model is overloaded"));
    assert(err503.category === 'SERVER_OVERLOAD' && err503.isPermanent === false, "4. Classifies 503 as SERVER_OVERLOAD");

    // 5. Opaque Key Labeling
    console.log("\n--- Category 2: Sensitive Logging & Opaque Labels ---");
    const label = getOpaqueKeyLabel(1, 5);
    assert(label === "key_1_of_5" && !label.includes("AIza") && !label.includes("AQ."), "5. Generates opaque key labels without leaking key fragments (key_1_of_5)");

    // 6-9. Gemini Credential Format Validation
    console.log("\n--- Category 3: Gemini Credential Format Validation ---");
    const geminiAbsent = validateGeminiCredentialFormat("");
    assert(geminiAbsent.valid === false && geminiAbsent.status === 'NOT_CONFIGURED', "6. Validates absent Gemini key as NOT_CONFIGURED (valid: false)");

    const geminiPlaceholder = validateGeminiCredentialFormat("your_gemini_api_key_here");
    assert(geminiPlaceholder.valid === false && geminiPlaceholder.status === 'PLACEHOLDER', "7. Validates placeholder Gemini key as PLACEHOLDER (valid: false)");

    const geminiOAuth = validateGeminiCredentialFormat(SYNTHETIC_GEMINI_KEY_OAUTH);
    assert(geminiOAuth.valid === false && geminiOAuth.status === 'INVALID_FORMAT_OAUTH_TOKEN', "8. Validates AQ. OAuth token format as INVALID_FORMAT_OAUTH_TOKEN (valid: false)");

    const geminiValid = validateGeminiCredentialFormat(SYNTHETIC_GEMINI_KEY_VALID_1);
    assert(geminiValid.valid === true && geminiValid.status === 'FORMAT_VALID', "9. Validates synthetic AIzaSy key format as FORMAT_VALID (valid: true)");

    // 10-12. OpenAI Credential Format Validation
    console.log("\n--- Category 4: OpenAI Credential Format Validation ---");
    const openaiAbsent = validateOpenAICredentialFormat("");
    assert(openaiAbsent.valid === false && openaiAbsent.status === 'NOT_CONFIGURED', "10. Validates absent OpenAI key as NOT_CONFIGURED (valid: false)");

    const openaiInvalid = validateOpenAICredentialFormat("invalid_non_sk_key_string_here");
    assert(openaiInvalid.valid === false && openaiInvalid.status === 'INVALID_FORMAT', "11. Validates non-sk OpenAI key as INVALID_FORMAT (valid: false)");

    const openaiValid = validateOpenAICredentialFormat(SYNTHETIC_OPENAI_KEY_VALID);
    assert(openaiValid.valid === true && openaiValid.status === 'FORMAT_VALID', "12. Validates synthetic sk- key format as FORMAT_VALID (valid: true)");

    // 13-14. Readiness Reporting Truthfulness
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

    const oauthEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_OAUTH]
    });
    const oauthHealth = oauthEngine.getProviderHealth();
    assert(
        oauthHealth.gemini.ready === false &&
        oauthHealth.gemini.status === 'INVALID_FORMAT_OAUTH_TOKEN' &&
        oauthHealth.liveAIReady === false,
        "14. AQ. credential does NOT make Gemini appear ready (ready: false, INVALID_FORMAT_OAUTH_TOKEN)"
    );

    // 15-18. Deterministic Mock Engine Executions
    console.log("\n--- Category 6: Deterministic Mock Engine Executions ---");
    const successEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_VALID_1],
        GoogleGenerativeAIClass: MockGeminiSuccess
    });
    const successRes = await successEngine.generateAnswer("Explain Virtual DOM");
    assert(successRes.provider === 'gemini' && successRes.isOffline === false, "15. Deterministic Mock: Gemini Direct Success with synthetic key returns live response");

    const failoverEngine = new AIEngine({
        openAIKey: SYNTHETIC_OPENAI_KEY_VALID,
        geminiKeys: [SYNTHETIC_GEMINI_KEY_VALID_1],
        OpenAIClientClass: MockOpenAIFail,
        GoogleGenerativeAIClass: MockGeminiSuccess
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
    class MockCascadeGemini {
        constructor(key) {
            this.key = key;
        }
        getGenerativeModel() {
            cascadeCallCount++;
            if (this.key === SYNTHETIC_GEMINI_KEY_VALID_1) {
                return {
                    generateContent: async () => {
                        const err = new Error("429 Too Many Requests");
                        err.status = 429;
                        throw err;
                    }
                };
            }
            return {
                generateContent: async () => ({
                    response: { text: () => "Key 2 succeeded after Key 1 was rate limited" }
                })
            };
        }
    }
    const cascadeEngine = new AIEngine({
        geminiKeys: [SYNTHETIC_GEMINI_KEY_VALID_1, SYNTHETIC_GEMINI_KEY_VALID_2],
        GoogleGenerativeAIClass: MockCascadeGemini
    });
    const cascadeRes = await cascadeEngine.generateAnswer("System design");
    assert(cascadeRes.provider === 'gemini' && cascadeRes.text.includes("Key 2 succeeded"), "18. Deterministic Mock: Quota Exhaustion & Cascade across synthetic keys");

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

    console.log("\n==================================================");
    console.log(`Unit Test Summary: ${passedCount} passed, ${failedCount} failed of 19 tests.`);
    console.log("==================================================");

    if (failedCount > 0 || passedCount !== 19) {
        process.exit(1);
    }
}

runUnitTests().catch(e => {
    console.error("Fatal unit test error:", e);
    process.exit(1);
});
