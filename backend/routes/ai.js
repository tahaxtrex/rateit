import express from 'express';
import {
    getUniversityById,
    getReviewsByUniversity,
    getUniversities,
    getAllReviews,
    getCachedResponse,
    cacheResponse,
    hashQuery
} from '../services/dataStore.js';
import { generateInsight, generateGlobalInsight, moderateContent } from '../services/geminiService.js';

const router = express.Router();

// POST /api/ai/chat - Generate AI insight (supports both specific and global queries)
router.post('/chat', async (req, res) => {
    try {
        const { query, universityId } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // If universityId is provided, get insight for that specific university
        if (universityId) {
            const uniData = await getUniversityById(universityId);
            if (!uniData) {
                return res.status(404).json({ error: 'University not found' });
            }

            // Check cache first
            const queryHash = hashQuery(query);
            try {
                const cachedResponse = await getCachedResponse(universityId, queryHash);
                if (cachedResponse) {
                    return res.json({ response: cachedResponse, cached: true });
                }
            } catch (cacheError) {
                console.warn('Cache lookup failed:', cacheError.message);
            }

            // Get reviews for context
            const reviews = await getReviewsByUniversity(universityId);

            // Generate AI response
            const response = await generateInsight(
                query,
                uniData.university.name,
                uniData.stats,
                reviews
            );

            // Cache the response
            try {
                await cacheResponse(universityId, queryHash, query, response);
            } catch (cacheError) {
                console.warn('Failed to cache response:', cacheError.message);
            }

            return res.json({ response, cached: false });
        }

        // No universityId - global chat across all universities
        const allUniversities = await getUniversities();
        const allReviews = await getAllReviews(100);

        const response = await generateGlobalInsight(query, allUniversities, allReviews);

        res.json({ response, cached: false, global: true });
    } catch (error) {
        console.error('AI chat error:', error);
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
        console.error('Moderation error:', error);
        res.status(500).json({ error: 'Failed to moderate content' });
    }
});

export default router;
