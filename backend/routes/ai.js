import express from 'express';
import {
    getUniversityById,
    getReviewsByUniversity,
    getUniversities,
    getAllReviews,
    getCachedResponse,
    cacheResponse,
    getCachedGlobalResponse,
    cacheGlobalResponse,
    preRankUniversities,
    getSentimentSummary,
    hashQuery
} from '../services/dataStore.js';
import { generateInsight, generateGlobalInsight, moderateContent } from '../services/geminiService.js';

const router = express.Router();

// POST /api/ai/chat - Generate AI insight (supports both specific and global queries)
router.post('/chat', async (req, res) => {
    try {
        const { query: userQuery, universityId, region } = req.body;

        if (!userQuery) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const queryHash = hashQuery(userQuery);

        // ============================================
        // SPECIFIC UNIVERSITY CHAT
        // ============================================
        if (universityId) {
            const uniData = await getUniversityById(universityId);
            if (!uniData) {
                return res.status(404).json({ error: 'University not found' });
            }

            // Check cache first
            try {
                const cachedResponse = await getCachedResponse(universityId, queryHash);
                if (cachedResponse) {
                    console.log(`[AI Route] Cache hit for university ${universityId}`);
                    return res.json({ response: cachedResponse, cached: true });
                }
            } catch (cacheError) {
                console.warn('[AI Route] Cache lookup failed:', cacheError.message);
            }

            // Get sentiment summary (precomputed) instead of raw reviews
            const sentimentSummary = uniData.stats.sentimentSummary || await getSentimentSummary(universityId);

            // Generate AI response with summary-driven approach
            console.log(`[AI Route] Generating insight for ${uniData.university.name} (summary-driven, no raw reviews)`);
            const response = await generateInsight(
                userQuery,
                uniData.university.name,
                uniData.stats,
                sentimentSummary
            );

            // Cache the response
            try {
                await cacheResponse(universityId, queryHash, userQuery, response);
            } catch (cacheError) {
                console.warn('[AI Route] Failed to cache response:', cacheError.message);
            }

            return res.json({ response, cached: false });
        }

        // ============================================
        // GLOBAL CHAT (no specific university)
        // ============================================

        // Check global cache first
        try {
            const cachedResponse = await getCachedGlobalResponse(queryHash, region);
            if (cachedResponse) {
                console.log(`[AI Route] Global cache hit`);
                return res.json({ response: cachedResponse, cached: true, global: true });
            }
        } catch (cacheError) {
            console.warn('[AI Route] Global cache lookup failed:', cacheError.message);
        }

        // Pre-rank universities (top 5 candidates) instead of fetching all
        console.log(`[AI Route] Pre-ranking universities for global query`);
        const rankedCandidates = await preRankUniversities(userQuery, region);

        if (rankedCandidates.length === 0) {
            return res.json({
                response: "I don't have enough data yet to answer that. As more students share their experiences, I'll be able to help more! 🎓",
                cached: false,
                global: true
            });
        }

        console.log(`[AI Route] Sending ${rankedCandidates.length} pre-ranked candidates to AI (selective, summary-based)`);
        const response = await generateGlobalInsight(userQuery, rankedCandidates);

        // Cache the global response
        try {
            await cacheGlobalResponse(queryHash, userQuery, response, region);
        } catch (cacheError) {
            console.warn('[AI Route] Failed to cache global response:', cacheError.message);
        }

        res.json({ response, cached: false, global: true });
    } catch (error) {
        console.error('[AI Route] Chat error:', error);
        res.status(500).json({ error: 'Failed to generate AI response' });
    }
});

// POST /api/ai/moderate - Moderate content
router.post('/moderate', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const result = await moderateContent(text);
        res.json(result);
    } catch (error) {
        console.error('[AI Route] Moderation error:', error);
        res.status(500).json({ error: 'Failed to moderate content' });
    }
});

export default router;
