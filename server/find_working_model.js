
import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenerativeAI } from "@google/generative-ai";

const key = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(key);

async function findWorkingModel() {
    console.log("Fetching model list...");
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    const response = await fetch(listUrl);
    const data = await response.json();

    if (!data.models) {
        console.log("❌ No models found.");
        return;
    }

    const models = data.models
        .filter(m => m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name.replace("models/", ""));

    console.log(`Found ${models.length} candidates. Testing one by one...`);

    for (const modelName of models) {
        process.stdout.write(`Testing ${modelName}... `);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hi");
            const text = result.response.text();
            console.log(`✅ SUCCESS! Response: ${text.substring(0, 20)}`);
            console.log(`RECOMMENDATION: Use "${modelName}"`);
            return; // Stop at first success
        } catch (e) {
            if (e.message.includes("429")) console.log("❌ Rate Limit/Quota 0");
            else if (e.message.includes("404")) console.log("❌ Not Found");
            else console.log(`❌ Error: ${e.message.substring(0, 50)}`);
        }
    }
    console.log("😭 All models failed.");
}

findWorkingModel();
