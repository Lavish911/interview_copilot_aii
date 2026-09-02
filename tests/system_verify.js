
import io from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_URL = 'http://localhost:3000';
const socket = io(SERVER_URL);

console.log("🚀 Starting Full System Verification...");

// --- TEST STATE ---
const results = {
    connection: 'PENDING',
    speech: 'PENDING',
    coding: 'PENDING',
    upload: 'PENDING',
    analytics: 'PENDING'
};

socket.on('connect', () => {
    console.log("✅ [Core] Socket Connected:", socket.id);
    results.connection = 'PASS';

    // 1. Trigger Speech
    console.log("🗣️ Testing Speech Engine...");
    socket.emit('question', { transcript: "Hello, who are you?", jobDescription: "" });
});

socket.on('answer', (text) => {
    console.log("🤖 [AI Answer]:", text.substring(0, 50) + "...");

    // Check for Coding Mode
    if (text.includes("```")) {
        console.log("✅ [Coding] Code Block Detected in response.");
        results.coding = 'PASS';
    } else {
        if (results.speech === 'PENDING') {
            console.log("✅ [Speech] Standard Speech recognized.");
            results.speech = 'PASS';

            // Now Trigger Coding Test
            console.log("👨‍💻 Testing Coding Mode...");
            socket.emit('question', { transcript: "Write a JavaScript function to reverse a string.", jobDescription: "" });
        }
    }
});

socket.on('speechAnalysisResult', (data) => {
    console.log("📊 [Analytics] Received Data:", data);
    if (data && data.score !== undefined) {
        results.analytics = 'PASS';
    }
});

// --- UPLOAD TEST ---
async function testUpload() {
    console.log("📄 Testing Resume Upload...");
    try {
        const dummyPath = path.join(__dirname, 'dummy_resume.txt');
        fs.writeFileSync(dummyPath, "This is a test resume for John Doe. Skills: JavaScript, React, Node.js.");

        const form = new FormData();
        form.append('file', fs.createReadStream(dummyPath));

        const res = await fetch(`${SERVER_URL}/api/upload-resume`, {
            method: 'POST',
            body: form
        });

        const json = await res.json();
        console.log("📤 Upload Response:", json);

        if (json.success) {
            console.log("✅ [Upload] Resume Uploaded Successfully.");
            results.upload = 'PASS';

            // Trigger ATS Scan
            console.log("🔍 Testing ATS Scan...");
            socket.emit('analyzeResume', { jobDescription: "Looking for a React Developer." });
        } else {
            console.error("❌ [Upload] Failed:", json);
            results.upload = 'FAIL';
        }

    } catch (e) {
        console.error("❌ [Upload] Error:", e);
        results.upload = 'FAIL';
    }
}

socket.on('resumeAnalysisResult', (data) => {
    console.log("📑 [ATS] Analysis Received:", data.summary);
    // Determine Final Status
    console.table(results);
    console.log("🎉 Test Sequence Complete. Exiting...");
    process.exit(0);
});

// Start Upload Test
testUpload();

// Timeout Safety
setTimeout(() => {
    console.log("⚠️ Test Timeout.");
    console.table(results);
    process.exit(1);
}, 15000);
