import express from 'express';
import {
    getUniversities,
    getUniversityById,
    addUniversity,
} from '../services/dataStore.js';

const router = express.Router();

// GET /api/universities - Get all universities with stats
router.get('/', async (req, res) => {
    try {
        const unis = await getUniversities();
        res.json(unis);
    } catch (error) {
        console.error('Error fetching universities:', error);
        res.status(500).json({ error: 'Failed to fetch universities' });
    }
});

// GET /api/universities/:id - Get single university with full stats
router.get('/:id', async (req, res) => {
    try {
        const result = await getUniversityById(req.params.id);
        if (!result) {
            return res.status(404).json({ error: 'University not found' });
        }
        res.json(result);
    } catch (error) {
        console.error('Error fetching university:', error);
        res.status(500).json({ error: 'Failed to fetch university' });
    }
});

// POST /api/universities - Add a new university (with AI deduplication)
router.post('/', async (req, res) => {
    try {
        const { name, location, country, description, nicheDetails, imageUrl } = req.body;

        if (!name || !location || !country) {
            return res.status(400).json({ error: 'Name, location, and country are required' });
        }

        // AI-powered normalization and deduplication
        const result = await addUniversity({
            name,
            location,
            country,
            description: description || '',
            nicheDetails: nicheDetails || '',
            imageUrl: imageUrl,
        });

        // If it matched an existing university, return 200 with info
        if (result.isExisting) {
            return res.status(200).json({
                ...result,
                message: 'University already exists. Your input has been added as an alias.',
            });
        }

        res.status(201).json(result);
    } catch (error) {
        console.error('Error adding university:', error);
        res.status(500).json({ error: 'Failed to add university' });
    }
});

export default router;
