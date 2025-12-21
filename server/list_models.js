
import dotenv from 'dotenv';
dotenv.config();

const key = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

async function list() {
    console.log("Fetching models from:", url.replace(key, "HIDDEN_KEY"));
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log("✅ Available Models:");
            data.models.forEach(m => {
                const name = m.name.replace("models/", "");
                if (m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${name}`);
                }
            });
        } else {
            console.error("❌ No models found or error:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

list();
