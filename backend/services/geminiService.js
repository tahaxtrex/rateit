import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Ensure dotenv is loaded
dotenv.config();

// Lazy initialization of AI client
let genAI = null;
const getGenAI = () => {
    if (!genAI && process.env.GEMINI_API_KEY) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI;
};

/**
 * AI-powered university name normalization
 * Takes user input and returns structured JSON with normalized university data
 * This ensures "Al Akhawayn" and "AUI" and "al-akhawayn university" all match the same university
 */
export const normalizeUniversityInput = async (userInput) => {
    const ai = getGenAI();
    if (!ai) {
        // Fallback to basic normalization
        return {
            normalizedName: basicNormalize(userInput.name || userInput),
            name: userInput.name || userInput,
            location: userInput.location || null,
            country: userInput.country || null,
            description: userInput.description || null,
        };
    }

    try {
        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `You are a university data normalizer. Given user input about a university, extract and normalize the information.

USER INPUT:
${typeof userInput === 'string' ? userInput : JSON.stringify(userInput)}

TASK:
1. Extract the university name, location (city), and country
2. Create a "normalizedName" - a canonical, lowercase, simplified version of the university name that can be used for matching
3. The normalizedName should:
   - Be lowercase
   - Remove common words like "university", "college", "of", "the", "institute"
   - Keep the most distinctive part of the name
   - Handle abbreviations (e.g., "MIT" → "massachusetts institute technology", "AUI" → "al akhawayn")

IMPORTANT: Common university name variations should normalize to the same value:
- "Al Akhawayn University", "AUI", "al-akhawayn" → normalizedName: "al akhawayn"
- "MIT", "Massachusetts Institute of Technology" → normalizedName: "massachusetts institute technology"
- "University of Nairobi", "UoN", "Nairobi University" → normalizedName: "nairobi"

Respond with ONLY valid JSON in this exact format:
{
  "normalizedName": "string (lowercase, simplified, for matching)",
  "name": "string (properly formatted display name)",
  "location": "string or null (city name)",
  "country": "string or null (country name)",
  "description": "string or null (if provided)"
}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();

        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                normalizedName: parsed.normalizedName || basicNormalize(parsed.name),
                name: parsed.name,
                location: parsed.location,
                country: parsed.country,
                description: parsed.description,
            };
        }

        throw new Error('No valid JSON in response');
    } catch (error) {
        console.error('AI normalization error:', error);
        // Fallback to basic normalization
        return {
            normalizedName: basicNormalize(userInput.name || userInput),
            name: userInput.name || userInput,
            location: userInput.location || null,
            country: userInput.country || null,
            description: userInput.description || null,
        };
    }
};

/**
 * Basic text normalization (fallback when AI is unavailable)
 */
export const basicNormalize = (text) => {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\b(university|college|institute|of|the|in|at)\b/g, '') // Remove common words
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
};

/**
 * Content moderation using Gemini
 */
export const moderateContent = async (text) => {
    const ai = getGenAI();
    if (!ai) {
        console.warn('No API Key provided, skipping moderation.');
        return { safe: true };
    }

    try {
        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `You are a content moderator for a university feedback platform.
Analyze the following text for: Hate speech, Severe Profanity, PII (Personal Identifiable Information like full names), or Threatening language.

Text: "${text}"

Respond with JSON only: { "safe": boolean, "reason": "string (optional, only if not safe)" }`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { safe: true };
    } catch (error) {
        console.error('Moderation error:', error);
        return { safe: true };
    }
};

/**
 * Generate AI insights for a specific university (RAG approach)
 */
export const generateInsight = async (query, universityName, stats, reviews) => {
    const ai = getGenAI();
    if (!ai) {
        return 'API Key missing. Cannot generate insight.';
    }

    try {
        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const statsSummary = `
University: ${universityName}
Total Reviews: ${stats.totalReviews || stats.total_reviews || 0}
Overall Rating: ${stats.averageRating || stats.average_rating || 0}/5
Category Breakdown:
${formatCategoryBreakdown(stats)}
`;

        const qualitativeSamples = reviews
            .slice(0, 20)
            .map((r) => `[${r.category} - ${r.rating}/5]: ${r.comment}`)
            .join('\n');

        const prompt = `You are a friendly student advisor who has talked to many students at ${universityName}. You speak casually like texting a friend.

STYLE GUIDE:
- Sound like a real person, not a robot or database
- Use phrases like: "A lot of students say...", "From what I've heard...", "Most people think...", "The general vibe is..."
- NEVER say "based on the data", "in our database", "according to reviews", or similar technical phrases
- Be casual and friendly ("tbh", "ngl", "pretty much")
- Use emojis sparingly but naturally 🎓
- If info is limited, say "I haven't heard much about that" not "we don't have data"
- Keep it concise and conversational

WHAT STUDENTS HAVE SHARED:
${statsSummary}

ACTUAL STUDENT QUOTES:
${qualitativeSamples}

QUESTION:
"${query}"

Respond like you're a helpful friend who knows the campus well:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text() || "I couldn't generate an insight at this moment.";
    } catch (error) {
        console.error('Gemini generation error:', error);
        return "Sorry, I'm having trouble analyzing the data right now. Please try again later.";
    }
};

/**
 * Global AI Chat - can answer questions about all universities
 * Used when no specific university is selected
 */
export const generateGlobalInsight = async (query, allUniversities, allReviews) => {
    const ai = getGenAI();
    if (!ai) {
        return 'API Key missing. Cannot generate insight.';
    }

    try {
        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Build context from all universities
        const universityContext = allUniversities
            .slice(0, 20)
            .map((u) => `- ${u.name} (${u.location}, ${u.country}): ${u.avgRating}/5 rating, ${u.reviewCount} reviews`)
            .join('\n');

        // Sample reviews from across universities
        const reviewSamples = allReviews
            .slice(0, 30)
            .map((r) => `[${r.universityName || 'University'} - ${r.category} - ${r.rating}/5]: ${r.comment}`)
            .join('\n');

        const prompt = `You're a friendly advisor who has talked to students from universities across Africa, Central Asia, and developing regions. You help students find the right school.

STYLE GUIDE:
- Sound like a real person who has visited these campuses and talked to students
- Use phrases like: "Students at [school] tend to say...", "A lot of people feel that...", "From what I've heard...", "The word on the street is..."
- NEVER use technical phrases like "based on data", "in our database", "according to our records"
- Be casual and warm ("honestly", "tbh", "from what I gather")
- Use emojis naturally 🌍🎓
- If you haven't heard about something, say "I haven't heard much about that yet" not "we don't have data"
- Compare schools by what students actually feel, not by numbers
- answer the user in the same language they ask in

SCHOOLS I KNOW ABOUT:
${universityContext}

WHAT STUDENTS HAVE TOLD ME:
${reviewSamples}

QUESTION:
"${query}"

Answer like a helpful friend who knows these schools:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text() || "I couldn't generate an insight at this moment.";
    } catch (error) {
        console.error('Gemini global chat error:', error);
        return "Sorry, I'm having trouble analyzing the data right now. Please try again later.";
    }
};

// Helper to format category breakdown for the prompt
function formatCategoryBreakdown(stats) {
    const categories = [
        { key: 'academics', label: 'Academics' },
        { key: 'dorms', label: 'Dorms & Housing' },
        { key: 'food', label: 'Food & Dining' },
        { key: 'social', label: 'Social Life' },
        { key: 'admin', label: 'Administration' },
        { key: 'cost', label: 'Cost of Living' },
        { key: 'safety', label: 'Safety' },
        { key: 'career', label: 'Career Support' },
    ];

    // Handle both database format and in-memory format
    if (stats.categoryBreakdown) {
        return Object.entries(stats.categoryBreakdown)
            .filter(([_, data]) => data.count > 0)
            .map(([cat, data]) => `- ${cat}: ${data.average}/5 (${data.count} reviews)`)
            .join('\n');
    }

    return categories
        .filter((c) => stats[`${c.key}_count`] > 0)
        .map((c) => `- ${c.label}: ${stats[`${c.key}_avg`]}/5 (${stats[`${c.key}_count`]} reviews)`)
        .join('\n');
}
