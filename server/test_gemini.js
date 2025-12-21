
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const key = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(key);

async function test() {
    const modelName = "gemini-flash-latest";
    console.log(`Testing: ${modelName}`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello.");
        console.log(`✅ Success: ${result.response.text()}`);
    } catch (e) {
        console.log(`❌ Failed:`, e.message);
    }
}

test();
