import io from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_URL = process.env.TEST_SERVER_URL || 'http://127.0.0.1:3000';

console.log(`\n======================================================`);
console.log(`🚀 Interview Copilot AI — System & Live Integration Test`);
console.log(`Target: ${SERVER_URL}`);
console.log(`======================================================\n`);

const results = {
    healthCheck: 'PENDING',
    socketConnection: 'PENDING',
    providerStatus: 'PENDING',
    resumeUpload: 'PENDING',
    ragIngestionAndGroundedQuery: 'PENDING',
    speechAnalytics: 'PENDING',
    liveAIGeneration: 'PENDING',
    offlineFallbackSafetyNet: 'PENDING',
    mockInterviewFlow: 'PENDING',
    atsAnalysisFlow: 'PENDING'
};

let spawnedServer = null;

function cleanupArtifacts() {
    if (spawnedServer) {
        try { spawnedServer.kill(); } catch {}
        spawnedServer = null;
    }
}

async function ensureServerRunning() {
    try {
        const res = await fetch(`${SERVER_URL}/health`);
        if (res.ok) {
            console.log("ℹ️ Existing server detected and responding.");
            return null;
        }
    } catch {
        // Not running
    }

    console.log(`ℹ️ No server detected at ${SERVER_URL}. Spawning test server process...`);
    const serverDir = path.resolve(__dirname, '../server');
    const serverPath = path.resolve(serverDir, 'server.js');
    const child = spawn('node', [serverPath], {
        cwd: serverDir,
        env: { ...process.env, PORT: '3000' },
        stdio: 'pipe'
    });

    let ready = false;
    for (let i = 0; i < 35; i++) {
        await new Promise(r => setTimeout(r, 400));
        try {
            const res = await fetch(`${SERVER_URL}/health`);
            if (res.ok) {
                ready = true;
                break;
            }
        } catch {
            // retry
        }
    }

    if (!ready) {
        child.kill();
        throw new Error(`Failed to start test server on ${SERVER_URL}`);
    }

    console.log("✅ Test server process started and ready.\n");
    return child;
}

function printSummaryAndExit(forcedExitCode = null) {
    cleanupArtifacts();
    console.log(`\n======================================================`);
    console.log(`📋 System Verification Summary`);
    console.log(`======================================================`);
    console.table(results);

    const isLiveBlocked = results.liveAIGeneration.startsWith('BLOCKED');
    const hasFailures = Object.values(results).some(v => v === 'FAIL');

    if (hasFailures || forcedExitCode === 1) {
        console.error(`❌ RELEASE GATE FAILED (Exit Code 1): One or more critical system checks failed.\n`);
        process.exit(1);
    } else if (isLiveBlocked) {
        console.warn(`⛔ RELEASE GATE BLOCKED (Exit Code 2):`);
        console.warn(`   Infrastructure, Socket.IO, upload, speech analytics, and offline safety nets passed.`);
        console.warn(`   However, LIVE AI generation is BLOCKED because no valid live API credentials are active.`);
        console.warn(`   Google AI Studio API credentials must start with "AIza..." (standard key) or "AQ." (authorization key).`);
        console.warn(`   Configure a valid Google AI Studio key (AIza... / AQ...) or OpenAI key (sk-...) to unblock live AI.\n`);
        process.exit(2);
    } else {
        console.log(`🎉 100% VERIFIED (Exit Code 0): All system checks and LIVE AI generation passed!\n`);
        process.exit(0);
    }
}

// Timeout safety: 45 seconds
const timeoutTimer = setTimeout(() => {
    console.error("\n❌ Test Suite Timed Out (45s)");
    printSummaryAndExit(1);
}, 45000);

async function runTests() {
    spawnedServer = await ensureServerRunning();

    // 1. Health Endpoint Test
    try {
        console.log("🔍 Checking /health endpoint...");
        const res = await fetch(`${SERVER_URL}/health`);
        const data = await res.json();
        console.log("   Health Response:", JSON.stringify(data));
        if (data.status === 'ok' && data.providers) {
            results.healthCheck = 'PASS';
            console.log("   ✅ Health endpoint OK");
        } else {
            results.healthCheck = 'FAIL';
        }
    } catch (err) {
        console.error("   ❌ Health check failed:", err.message);
        results.healthCheck = 'FAIL';
    }

    // 2. Resume Upload Test
    let uploadedResumeText = "";
    try {
        console.log("\n📄 Testing resume upload endpoint (/api/upload-resume)...");
        const dummyPath = path.join(__dirname, 'dummy_resume.txt');
        if (!fs.existsSync(dummyPath)) {
            fs.writeFileSync(dummyPath, "John Doe - Senior Software Engineer. Expertise in React, Node.js, TypeScript, PostgreSQL, System Design.");
        }

        const form = new FormData();
        form.append('file', fs.createReadStream(dummyPath));

        const uploadRes = await fetch(`${SERVER_URL}/api/upload-resume`, {
            method: 'POST',
            body: form
        });
        const uploadData = await uploadRes.json();
        console.log("   Upload Response:", JSON.stringify(uploadData));

        if (uploadData.success && uploadData.text) {
            uploadedResumeText = uploadData.text;
            results.resumeUpload = 'PASS';
            console.log("   ✅ Resume upload succeeded");
        } else {
            results.resumeUpload = 'FAIL';
        }
    } catch (err) {
        console.error("   ❌ Upload failed:", err.message);
        results.resumeUpload = 'FAIL';
    }

    // 2b. RAG Document Ingestion & Grounded Retrieval-Augmented Generation Test
    try {
        console.log("\n📚 Testing RAG pipeline (/api/rag/documents & /api/rag/query)...");
        const ragSessionId = `sys_verify_rag_${Date.now()}`;
        const ingestRes = await fetch(`${SERVER_URL}/api/rag/documents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': ragSessionId
            },
            body: JSON.stringify({
                filename: 'project_chronos_spec.md',
                docType: 'technical_doc',
                text: '# System Architecture\n\nProject Chronos is a distributed payment settlement engine built by Alex Rivera in Golang and Kubernetes. It uses Raft consensus and pgvector, reducing p99 settlement latency from 410ms to 38ms across 12 global regions.'
            })
        });
        const ingestData = await ingestRes.json();
        if (ingestData.success && ingestData.document?.chunkCount >= 1) {
            const queryRes = await fetch(`${SERVER_URL}/api/rag/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': ragSessionId
                },
                body: JSON.stringify({
                    question: 'What latency reduction did Project Chronos achieve and what technologies were used?'
                })
            });
            const queryData = await queryRes.json();
            if (
                queryData.success &&
                queryData.grounded === true &&
                Array.isArray(queryData.sources) &&
                queryData.sources.length >= 1 &&
                queryData.sources[0].filename === 'project_chronos_spec.md' &&
                (queryData.answer.includes('38ms') || queryData.answer.includes('410ms') || queryData.answer.includes('Chronos'))
            ) {
                results.ragIngestionAndGroundedQuery = `PASS (Grounded in ${queryData.sources.length} chunk(s), model: ${ingestData.document.embeddingModel})`;
                console.log(`   ✅ RAG grounded answer & citation verified (${ingestData.document.embeddingModel})`);
            } else {
                results.ragIngestionAndGroundedQuery = 'FAIL';
                console.error("   ❌ RAG query response did not meet grounding criteria:", JSON.stringify(queryData));
            }
        } else if (ingestData.code === 'EMBEDDING_UNAVAILABLE') {
            results.ragIngestionAndGroundedQuery = 'BLOCKED (No live embedding credentials configured)';
        } else {
            results.ragIngestionAndGroundedQuery = 'FAIL';
            console.error("   ❌ RAG ingestion failed:", JSON.stringify(ingestData));
        }
    } catch (err) {
        console.error("   ❌ RAG verification error:", err.message);
        results.ragIngestionAndGroundedQuery = 'FAIL';
    }

    // 3. Socket.IO Live Copilot Tests (including streaming answerChunk & rag:contextUsed)
    console.log("\n🔌 Connecting Socket.IO Live Copilot client...");
    const socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000
    });

    let chunkReceived = false;
    let ragContextEventReceived = false;

    socket.on('connect', () => {
        console.log(`   ✅ Socket connected (ID: ${socket.id})`);
        results.socketConnection = 'PASS';

        if (uploadedResumeText) {
            socket.emit('updateResume', uploadedResumeText);
        }

        console.log("   📊 Testing speech analytics...");
        socket.emit('analyzeSpeech', "I basically like react, you know, because it is fast and component based.");
    });

    socket.on('providerStatus', (status) => {
        console.log("   🤖 Provider status received:", JSON.stringify(status));
        results.providerStatus = 'PASS';

        console.log("   🗣️ Testing Live Copilot question handler (streaming + RAG context)...");
        socket.emit('question', { transcript: "What is the Virtual DOM in React and how does it relate to my JavaScript and React skills?" });
    });

    socket.on('speechAnalysisResult', (data) => {
        console.log("   ✅ Speech analysis result received, score:", data.score);
        if (data && data.score !== undefined) {
            results.speechAnalytics = 'PASS';
        }
    });

    socket.on('answerChunk', (data) => {
        if (data && typeof data.chunk === 'string') {
            chunkReceived = true;
        }
    });

    socket.on('rag:contextUsed', (ctx) => {
        if (ctx && typeof ctx.status === 'string') {
            ragContextEventReceived = true;
            console.log(`   📚 Live Copilot rag:contextUsed received (status: ${ctx.status}, grounded: ${ctx.grounded})`);
        }
    });

    let mockTriggered = false;
    let atsTriggered = false;

    socket.on('answer', (text) => {
        console.log(`   📥 Received Answer (${text.length} chars, streamedChunks=${chunkReceived}, ragEvent=${ragContextEventReceived}): ${text.substring(0, 75).replace(/\n/g, ' ')}...`);

        const isOffline = text.includes("📴 **Offline Mode**");

        if (isOffline) {
            results.liveAIGeneration = 'BLOCKED (Live credentials rejected or missing; offline fallback served)';
            results.offlineFallbackSafetyNet = 'PASS';
            console.warn("   ⚠️ Live AI generation did not produce output; Offline Fallback safety net engaged.");
        } else {
            results.liveAIGeneration = `PASS (Live AI + streaming=${chunkReceived} + ragContext=${ragContextEventReceived})`;
            results.offlineFallbackSafetyNet = 'PASS (Not needed; live succeeded)';
            console.log("   ✅ Real Live Copilot AI generation & streaming verified!");
        }

        if (!mockTriggered) {
            mockTriggered = true;
            setTimeout(() => {
                console.log("   🎙️ Testing startMockInterview...");
                socket.emit('startMockInterview');
            }, 600);
        }
    });

    let mockTier = 'offline_fast_engine';
    socket.on('providerMeta', (meta) => {
        if (meta?.operation === 'mockQuestion') {
            mockTier = meta.tier;
        }
    });

    socket.on('mockQuestion', (q) => {
        console.log(`   ✅ Mock question received: "${q.substring(0, 60)}..."`);
        const isLive = mockTier === 'gemini_live';
        results.mockInterviewFlow = `PASS (Served by ${isLive ? 'live Gemini' : 'FastEngine offline fallback'})`;

        if (!atsTriggered) {
            atsTriggered = true;
            setTimeout(() => {
                console.log("   📑 Testing ATS scan (analyzeResume)...");
                socket.emit('analyzeResume', { jobDescription: "Looking for a React and Node.js Engineer." });
            }, 600);
        }
    });

    socket.on('resumeAnalysisResult', (data) => {
        console.log("   ✅ ATS Analysis received, score:", data.score, "summary:", data.summary?.substring(0, 60));
        const atsTier = data?.providerTier === 'gemini_live' ? 'live Gemini' : 'FastEngine offline fallback';
        results.atsAnalysisFlow = `PASS (Served by ${atsTier})`;

        clearTimeout(timeoutTimer);
        socket.disconnect();
        printSummaryAndExit();
    });

    socket.on('connect_error', (err) => {
        console.error("   ❌ Socket connect error:", err.message);
        results.socketConnection = 'FAIL';
    });
}

runTests().catch(err => {
    console.error("Fatal test runner error:", err);
    printSummaryAndExit(1);
});
