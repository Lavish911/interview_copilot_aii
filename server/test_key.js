import { GoogleGenerativeAI } from '@google/generative-ai';

async function testKey(modelName) {
    const key = "AIzaSyCecDG2KJvcn0CiAxYouzIQiAZN4fjLOq0"; // First key
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
    await testKey("gemini-flash-latest");
    await testKey("gemini-1.5-pro-latest");
    await testKey("gemini-2.5-flash-lite");
    await testKey("gemini-2.0-flash-lite");
}

run();
