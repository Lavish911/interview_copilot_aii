import io from 'socket.io-client';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = process.env.TEST_PORT || '3000';
const SERVER_URL = process.env.TEST_SERVER_URL || `http://localhost:${TEST_PORT}`;

console.log(`======================================================`);
console.log(`🧪 Running Permanent Session Isolation Regression Test`);
console.log(`Target: ${SERVER_URL}`);
console.log(`Note: Testing socket-level session isolation (per connection),`);
console.log(`      not identity-based authenticated ownership.`);
console.log(`======================================================\n`);

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

function connectClient(url) {
    return new Promise((resolve, reject) => {
        const socket = io(url, {
            transports: ['websocket', 'polling'],
            timeout: 8000,
            forceNew: true
        });
        const timer = setTimeout(() => {
            socket.disconnect();
            reject(new Error("Socket connection timed out"));
        }, 8000);

        socket.on('connect', () => {
            clearTimeout(timer);
            resolve(socket);
        });
        socket.on('connect_error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

function requestState(socket) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("requestSessionState timed out"));
        }, 5000);

        socket.once('sessionStateUpdate', (data) => {
            clearTimeout(timer);
            resolve(data);
        });
        socket.emit('requestSessionState');
    });
}

async function ensureServerRunning() {
    try {
        const res = await fetch(`${SERVER_URL}/health`);
        if (res.ok) {
            console.log("ℹ️ Existing server detected and responding.");
            return null; // No spawned process to manage
        }
    } catch {
        // Not running, need to spawn
    }

    console.log(`ℹ️ No server detected at ${SERVER_URL}. Spawning test server process...`);
    const serverPath = path.resolve(__dirname, '../server/server.js');
    const child = spawn('node', [serverPath], {
        env: { ...process.env, PORT: TEST_PORT },
        stdio: 'pipe'
    });

    // Wait for server to become responsive
    let ready = false;
    for (let i = 0; i < 30; i++) {
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
        throw new Error(`Failed to start test server on port ${TEST_PORT}`);
    }

    console.log("✅ Test server process started and ready.\n");
    return child;
}

async function runIsolationSuite() {
    let serverProcess = null;

    try {
        serverProcess = await ensureServerRunning();

        // ---------------------------------------------------------------------
        // Test 1: Distinct Sessions for Independent Clients
        // ---------------------------------------------------------------------
        console.log("--- 1. Connecting Client A and Client B ---");
        const clientA = await connectClient(SERVER_URL);
        const clientB = await connectClient(SERVER_URL);

        assert(
            clientA.id && clientB.id && clientA.id !== clientB.id,
            "1. Two independent clients receive distinct socket IDs"
        );

        // ---------------------------------------------------------------------
        // Test 2: Client A's resume state is not visible to Client B
        // ---------------------------------------------------------------------
        console.log("\n--- 2. Uploading resume to Client A and verifying Client B isolation ---");
        await new Promise(resolve => {
            clientA.once('resumeConfirmed', resolve);
            clientA.emit('updateResume', "Client A Secret Resume: Senior Distributed Systems Architect at AlphaCorp");
        });

        const stateA_afterUpload = await requestState(clientA);
        const stateB_initial = await requestState(clientB);

        assert(
            stateA_afterUpload.resumeLoaded === true,
            "2a. Client A confirms resume is loaded in its session"
        );
        assert(
            stateB_initial.resumeLoaded === false,
            "2b. Client B does NOT see Client A's resume (resumeLoaded: false)"
        );

        // ---------------------------------------------------------------------
        // Test 3: Concurrent writes do not cross-overwrite session data
        // ---------------------------------------------------------------------
        console.log("\n--- 3. Concurrent writes between Client A and Client B ---");
        await Promise.all([
            new Promise(resolve => {
                clientA.once('settingsConfirmed', resolve);
                clientA.emit('updateSettings', { role: "Principal Architect", company: "AlphaTech" });
            }),
            new Promise(resolve => {
                clientB.once('settingsConfirmed', resolve);
                clientB.emit('updateSettings', { role: "Junior Frontend Engineer", company: "BetaStartup" });
            }),
            new Promise(resolve => {
                clientB.once('resumeConfirmed', resolve);
                clientB.emit('updateResume', "Client B Resume: Junior Frontend Engineer proficient in React");
            })
        ]);

        const stateA_afterConcurrent = await requestState(clientA);
        const stateB_afterConcurrent = await requestState(clientB);

        assert(
            stateA_afterConcurrent.settings.role === "Principal Architect" &&
            stateA_afterConcurrent.settings.company === "AlphaTech" &&
            stateA_afterConcurrent.resumeLoaded === true,
            "3a. Client A retained its own settings and resume despite concurrent writes from Client B"
        );
        assert(
            stateB_afterConcurrent.settings.role === "Junior Frontend Engineer" &&
            stateB_afterConcurrent.settings.company === "BetaStartup" &&
            stateB_afterConcurrent.resumeLoaded === true,
            "3b. Client B recorded its own distinct settings and resume without overwriting Client A"
        );

        // ---------------------------------------------------------------------
        // Test 4: Newly connected Client C does not inherit state
        // ---------------------------------------------------------------------
        console.log("\n--- 4. Connecting Client C and verifying pristine empty state ---");
        const clientC = await connectClient(SERVER_URL);
        const stateC_initial = await requestState(clientC);

        assert(
            stateC_initial.resumeLoaded === false &&
            stateC_initial.analysis === null &&
            stateC_initial.settings.role === "Software Engineer" &&
            stateC_initial.settings.company === "General Tech",
            "4. Newly connected Client C does not inherit resume or settings from Client A or B"
        );

        // ---------------------------------------------------------------------
        // Test 5: Session state remains isolated after disconnect & reconnect
        // ---------------------------------------------------------------------
        console.log("\n--- 5. Testing disconnect & reconnect behavior ---");
        clientA.disconnect();
        await new Promise(r => setTimeout(r, 200));

        // Client B is still alive and retains its state
        const stateB_afterDisconnectA = await requestState(clientB);
        assert(
            stateB_afterDisconnectA.resumeLoaded === true &&
            stateB_afterDisconnectA.settings.company === "BetaStartup",
            "5a. Client B retains its session unaffected after Client A disconnects"
        );

        // Reconnect Client A as a fresh socket
        const clientA_reconnected = await connectClient(SERVER_URL);
        const stateA_reconnected = await requestState(clientA_reconnected);
        assert(
            stateA_reconnected.resumeLoaded === false &&
            stateA_reconnected.settings.role === "Software Engineer",
            "5b. Reconnected Client A receives a clean, isolated session without stale data"
        );

        // ---------------------------------------------------------------------
        // Test 6: Settings isolation across multiple clients
        // ---------------------------------------------------------------------
        console.log("\n--- 6. Settings isolation validation ---");
        await new Promise(resolve => {
            clientB.once('settingsConfirmed', resolve);
            clientB.emit('updateSettings', { tone: "Casual", detailLevel: "Detailed" });
        });

        const stateB_updatedSettings = await requestState(clientB);
        const stateC_settingsCheck = await requestState(clientC);

        assert(
            stateB_updatedSettings.settings.tone === "Casual" &&
            stateB_updatedSettings.settings.detailLevel === "Detailed",
            "6a. Client B updated tone and detailLevel successfully"
        );
        assert(
            stateC_settingsCheck.settings.tone === "Professional" &&
            stateC_settingsCheck.settings.detailLevel === "Concise",
            "6b. Client C settings remain completely unaffected by Client B's update"
        );

        // Cleanup sockets
        clientB.disconnect();
        clientC.disconnect();
        clientA_reconnected.disconnect();

        console.log(`\n======================================================`);
        console.log(`📋 Session Isolation Summary: ${passedCount} passed, ${failedCount} failed.`);
        console.log(`======================================================`);

        if (failedCount > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }

    } catch (err) {
        console.error("❌ Session isolation suite fatal error:", err);
        process.exit(1);
    } finally {
        if (serverProcess) {
            console.log("🛑 Stopping spawned test server process...");
            serverProcess.kill('SIGTERM');
        }
    }
}

runIsolationSuite();
