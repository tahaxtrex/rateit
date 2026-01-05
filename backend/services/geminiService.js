import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Ensure dotenv is loaded
dotenv.config();

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    SIMILARITY_THRESHOLD: 0.7,          // Confidence threshold for deterministic matching
    NORMALIZE_MAX_TOKENS: 150,          // Max output tokens for normalization
    INSIGHT_MAX_TOKENS: 300,            // Max output tokens for single university insight
    GLOBAL_INSIGHT_MAX_TOKENS: 400,     // Max output tokens for global insight
    AMBIGUOUS_LENGTH_THRESHOLD: 5,      // Strings <= this length are considered ambiguous
};

// Common acronyms that need AI resolution
const KNOWN_ACRONYMS = new Set([
    'aui', 'mit', 'uon', 'wiut', 'aku', 'usiu', 'kemu', 'jkuat', 'emu',
    'lsu', 'ucla', 'nyu', 'usc', 'ucb', 'unc', 'ut', 'um', 'bu', 'bc'
]);

// Lazy initialization of AI client
let genAI = null;
const getGenAI = () => {
    if (!genAI && process.env.GEMINI_API_KEY) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI;
};

// ============================================
// INPUT ANALYSIS UTILITIES
// ============================================

/**
 * Detect if input is ambiguous and requires AI resolution
 * Ambiguous inputs include: acronyms, very short strings, non-ASCII, mixed case initials
 */
export const isAmbiguousInput = (input) => {
    const text = typeof input === 'string' ? input : (input.name || '');
    const normalized = text.trim().toLowerCase();

    // Empty or too short
    if (normalized.length <= 2) return true;

    // Known acronym
    if (KNOWN_ACRONYMS.has(normalized)) return true;

    // All uppercase and short (likely acronym)
    if (text === text.toUpperCase() && text.length <= CONFIG.AMBIGUOUS_LENGTH_THRESHOLD) return true;

    // Contains non-ASCII (cross-language variant)
    if (/[^\x00-\x7F]/.test(text)) return true;

    // Looks like an acronym pattern (all caps, periods between letters like "M.I.T.")
    if (/^[A-Z](\.[A-Z])+\.?$/.test(text.trim())) return true;

    return false;
};

/**
 * Basic text normalization (enhanced with more stop words)
 * This is the deterministic phase - no AI required
 */
export const basicNormalize = (text) => {
    if (!text) return '';

    // Extended stop words for university names
    const stopWords = [
        'university', 'college', 'institute', 'school', 'academy',
        'of', 'the', 'in', 'at', 'for', 'and',
        'international', 'national', 'state', 'federal', 'public', 'private',
        'higher', 'education', 'learning', 'studies'
    ];

    const stopWordPattern = new RegExp(`\\b(${stopWords.join('|')})\\b`, 'gi');

    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')           // Remove special chars except hyphen
        .replace(/-/g, ' ')                  // Replace hyphens with spaces
        .replace(stopWordPattern, '')        // Remove stop words
        .replace(/\s+/g, ' ')               // Normalize whitespace
        .trim();
};

/**
 * AI-powered university name normalization
 * Only called when deterministic matching fails and input is ambiguous
 */
export const normalizeUniversityInput = async (userInput, skipAI = false) => {
    const inputName = typeof userInput === 'string' ? userInput : (userInput.name || userInput);
    const deterministicNorm = basicNormalize(inputName);

    // If skipAI is true or input is not ambiguous, return deterministic result
    if (skipAI || !isAmbiguousInput(userInput)) {
        console.log('[Gemini] Skipping AI normalization - input is not ambiguous:', inputName);
        return {
            normalizedName: deterministicNorm,
            name: inputName,
            location: userInput.location || null,
            country: userInput.country || null,
            description: userInput.description || null,
            usedAI: false,
        };
    }

    const ai = getGenAI();
    if (!ai) {
        console.warn('[Gemini] No API key - falling back to deterministic normalization');
        return {
            normalizedName: deterministicNorm,
            name: inputName,
            location: userInput.location || null,
            country: userInput.country || null,
            description: userInput.description || null,
            usedAI: false,
        };
    }

    try {
        console.log('[Gemini] Using AI normalization for ambiguous input:', inputName);

        const model = ai.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                maxOutputTokens: 1000,
            }
        });

        const prompt = `Normalize this university name. Return ONLY JSON.

INPUT: "${typeof userInput === 'string' ? userInput : JSON.stringify(userInput)}"

Rules:
- normalizedName: lowercase, remove "university/college/institute/of/the", keep distinctive parts
- Handle acronyms: "MIT"→"massachusetts institute technology", "AUI"→"al akhawayn", "UoN"→"nairobi"
- name: properly formatted display name

JSON format: {"normalizedName":"","name":"","location":null,"country":null}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                normalizedName: parsed.normalizedName || deterministicNorm,
                name: parsed.name || inputName,
                location: parsed.location || userInput.location || null,
                country: parsed.country || userInput.country || null,
                description: parsed.description || userInput.description || null,
                usedAI: true,
            };
        }

        throw new Error('No valid JSON in response');
    } catch (error) {
        console.error('[Gemini] AI normalization error:', error.message);
        return {
            normalizedName: deterministicNorm,
            name: inputName,
            location: userInput.location || null,
            country: userInput.country || null,
            description: userInput.description || null,
            usedAI: false,
        };
    }
};

/**
 * Content moderation using Gemini
 */
export const moderateContent = async (text) => {
    const ai = getGenAI();
    if (!ai) {
        console.warn('[Gemini] No API Key provided, skipping moderation.');
        return { safe: true };
    }

    try {
        const model = ai.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                maxOutputTokens: 256,
            }
        });

        const prompt = `Moderate this text for: Hate speech, Severe Profanity, PII, Threats.
Text: "${text}"
JSON only: {"safe":boolean,"reason":"optional"}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { safe: true };
    } catch (error) {
        console.error('[Gemini] Moderation error:', error.message);
        return { safe: true };
    }
};

/**
 * Generate AI insights for a specific university (Summary-Driven RAG)
 * Uses precomputed sentiment summary instead of raw reviews
 */
export const generateInsight = async (query, universityName, stats, sentimentSummary = null) => {
    const ai = getGenAI();
    if (!ai) {
        return 'API Key missing. Cannot generate insight.';
    }

    try {
        const model = ai.getGenerativeModel({
            model: 'gemini-3-flash',
            generationConfig: {
                maxOutputTokens: 1024,
            }
        });

        // Build compact context from stats
        const totalReviews = stats.totalReviews || stats.total_reviews || 0;
        const avgRating = stats.averageRating || stats.average_rating || 0;

        // Format category averages compactly
        const categoryStr = formatCategoryBreakdownCompact(stats);

        // Use sentiment summary if available
        const sentimentStr = sentimentSummary
            ? `Tone: ${sentimentSummary.tone}. Good: ${sentimentSummary.positivePhrases || 'N/A'}. Bad: ${sentimentSummary.negativePhrases || 'N/A'}`
            : 'No sentiment data yet.';

        const prompt = `You're a friendly student advisor at ${universityName}. Answer briefly like texting a friend.

Stats: ${totalReviews} reviews, ${avgRating}/5 avg. ${categoryStr}
Vibe: ${sentimentStr}

Q: "${query}"

Reply in 2-3 sentences, casual tone, no markdown/bullets, use emojis sparingly 🎓`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text() || "I couldn't generate an insight at this moment.";
    } catch (error) {
        console.error('[Gemini] Generation error:', error.message);
        return "Sorry, I'm having trouble right now. Try again later.";
    }
};

/**
 * Global AI Chat - Selective & Summary-Based (RAG)
 * Only receives pre-ranked top candidates with summaries
 */
export const generateGlobalInsight = async (query, rankedCandidates) => {
    const ai = getGenAI();
    if (!ai) {
        console.error('[Gemini] No AI client available');
        return 'API Key missing. Cannot generate insight.';
    }

    try {
        const model = ai.getGenerativeModel({
            model: 'gemini-3-flash',
            generationConfig: {
                maxOutputTokens: 2048, // High limit to allow complete responses
            }
        });

        // Build compact university context from pre-ranked candidates (max 5)
        const universityContext = rankedCandidates
            .slice(0, 5)
            .map(u => {
                const summary = u.sentimentSummary;
                const tone = summary?.tone || 'unknown';
                return `${u.name} (${u.location}, ${u.country}): ${u.avgRating}/5, ${u.reviewCount} reviews, ${tone} vibe`;
            })
            .join('\n');

        const prompt = `You're a friendly advisor who knows these schools. Help find the right one.

Schools:
${universityContext}

Q: "${query}"

Reply in 3-4 sentences, compare only 2-3 best options, casual tone, no markdown/bullets 🌍`;

        console.log('[Gemini] Sending global insight request to AI...');
        const result = await model.generateContent(prompt);

        try {
            const response = await result.response;
            console.log('[Gemini] Got response object, type:', typeof response);

            // Log full response structure for debugging
            console.log('[Gemini] Response candidates:', response.candidates?.length || 0);
            console.log('[Gemini] Finish reason:', response.candidates?.[0]?.finishReason);

            // Check for safety blocks
            if (response.candidates?.[0]?.finishReason === 'SAFETY') {
                console.error('[Gemini] Response blocked by safety filters');
                console.error('[Gemini] Safety ratings:', JSON.stringify(response.candidates[0].safetyRatings, null, 2));
                return "I couldn't generate a response. Please try rephrasing your question.";
            }

            // Check if content exists
            if (!response.candidates || response.candidates.length === 0) {
                console.error('[Gemini] No candidates in response');
                return "I couldn't generate an insight at this moment.";
            }

            const text = response.text();
            console.log('[Gemini] Received response:', text ? `${text.length} chars` : 'empty');
            console.log('[Gemini] Full response text:', text);

            if (!text || text.trim().length === 0) {
                console.error('[Gemini] Empty response received from AI');
                return "I couldn't generate an insight at this moment.";
            }

            return text;
        } catch (parseError) {
            console.error('[Gemini] Error parsing response:', parseError.message);
            console.error('[Gemini] Parse error stack:', parseError.stack);
            throw parseError; // Re-throw to be caught by outer catch
        }
    } catch (error) {
        console.error('[Gemini] Global chat error:', error.message);
        console.error('[Gemini] Error stack:', error.stack);
        if (error.response) {
            console.error('[Gemini] Error response:', JSON.stringify(error.response, null, 2));
        }
        return "Sorry, I'm having trouble right now. Try again later.";
    }
};

// ============================================
// HELPERS
// ============================================

/**
 * Format category breakdown compactly for prompts
 */
function formatCategoryBreakdownCompact(stats) {
    const parts = [];

    if (stats.categoryBreakdown) {
        for (const [cat, data] of Object.entries(stats.categoryBreakdown)) {
            if (data.count > 0) {
                parts.push(`${cat.split(' ')[0]}:${data.average}`);
            }
        }
    } else {
        // Handle database format
        const cats = [
            { key: 'academics', label: 'Acad' },
            { key: 'dorms', label: 'Dorms' },
            { key: 'food', label: 'Food' },
            { key: 'social', label: 'Social' },
            { key: 'admin', label: 'Admin' },
            { key: 'cost', label: 'Cost' },
            { key: 'safety', label: 'Safety' },
            { key: 'career', label: 'Career' },
        ];
        for (const c of cats) {
            if (stats[`${c.key}_count`] > 0) {
                parts.push(`${c.label}:${stats[`${c.key}_avg`]}`);
            }
        }
    }

    return parts.length > 0 ? parts.join(', ') : 'No category data';
}

// Helper to format category breakdown for the prompt (legacy, kept for compatibility)
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
