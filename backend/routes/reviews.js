import express from 'express';
import {
    getReviewsByUniversity,
    getAllReviews,
    addReview,
    Category
} from '../services/dataStore.js';
import { moderateContent } from '../services/geminiService.js';

const router = express.Router();

// GET /api/reviews - Get all reviews (optionally filtered by universityId)
router.get('/', async (req, res) => {
    try {
        const { universityId } = req.query;

        if (universityId) {
            const reviews = await getReviewsByUniversity(universityId);
            res.json(reviews);
        } else {
            const reviews = await getAllReviews();
            res.json(reviews);
        }
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// GET /api/reviews/categories - Get available categories
router.get('/categories', (req, res) => {
    res.json(Object.values(Category));
});

// POST /api/reviews - Submit a new review
router.post('/', async (req, res) => {
    try {
        const { universityId, category, rating, comment } = req.body;

        // Validation
        if (!universityId || !category || !rating || !comment) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const ratingNum = parseInt(rating);
        if (ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        if (comment.length < 10) {
            return res.status(400).json({ error: 'Comment must be at least 10 characters' });
        }

        // Content moderation
        const moderation = await moderateContent(comment);
        if (!moderation.safe) {
            return res.status(400).json({
                error: 'Review rejected',
                reason: moderation.reason || 'Content violation detected'
            });
        }

        // Add review
        const newReview = await addReview({
            universityId,
            category,
            rating: ratingNum,
            comment,
        });

        res.status(201).json(newReview);
    } catch (error) {
        console.error('Error adding review:', error);
        res.status(500).json({ error: 'Failed to submit review' });
    }
});

export default router;
