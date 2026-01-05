import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";


dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ ERROR: API Key is missing. Check your .env file.");
    process.exit(1);
}


async function listModels() {
    console.log("Checking v1alpha (Experimental) endpoint...");

    // We use a direct fetch because the SDK defaults hide the alpha models
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1alpha/models?key=${apiKey}`
    );

    const data = await response.json();

    if (data.models) {
        data.models.forEach(model => {
            // Filter to only show 'flash' models so the list isn't huge
            if (model.name.includes("flash")) {
                console.log(`FOUND: ${model.name}`);
            }
        });
    } else {
        console.log("No models found or error:", data);
    }
}

listModels();