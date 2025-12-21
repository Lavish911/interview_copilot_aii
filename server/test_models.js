
import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenerativeAI } from "@google/generative-ai";

const key = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(key);

async function testModel(modelName) {
    console.log(`Testing ${modelName}...`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello");
        console.log(`✅ ${modelName} Works! Response:`, result.response.text());
    } catch (e) {
        console.error(`❌ ${modelName} Failed:`, e.message);
    }
}

async function run() {
    await testModel("gemini-pro");
    await testModel("gemini-1.5-flash-001");
    await testModel("gemini-1.5-flash"); // Just in case list was weird
    await testModel("gemini-1.5-pro");
}

run();
