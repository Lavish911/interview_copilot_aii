import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { CANONICAL_GEMINI_MODELS } from './ai_engine.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function testKey(modelName, dryRun = false) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("GEMINI_API_KEY not set in environment");
        return;
    }
    if (dryRun) {
        console.log(`[Validation] dotenv loaded. Model target: ${modelName}. Key configured: true. (Dry run — no live request)`);
        return;
    }
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName });
    try {
        await model.generateContent("hello");
        console.log(`${modelName}: Success!`);
    } catch (e) {
        console.log(`${modelName}: ERROR -> ${e.message.split('\n')[0]}`);
    }
}

async function run() {
    const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
    for (const model of CANONICAL_GEMINI_MODELS) {
        await testKey(model, isDryRun);
    }
}

run();
