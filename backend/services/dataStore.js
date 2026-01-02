// Database-backed data store for RateIt
// Connects to PostgreSQL (AWS RDS) and handles all data operations

import { query, getClient } from './database.js';
import { normalizeUniversityInput, basicNormalize } from './geminiService.js';

// ============================================
// CATEGORIES
// ============================================

export const Category = {
    ACADEMICS: 'Academics',
    DORMS: 'Dorms & Housing',
    FOOD: 'Food & Dining',
    SOCIAL: 'Social Life',
    ADMIN: 'Administration',
    COST: 'Cost of Living',
    SAFETY: 'Safety',
    CAREER: 'Career Support',
    TRANSPORTATION: 'Transportation',
    FACILITIES: 'Facilities',
    STUDENT_SERVICES: 'Student Services',
    EXTRACURRICULARS: 'Extracurriculars',
    OTHER: 'Other',
};

// ============================================
// UNIVERSITIES
// ============================================

/**
 * Get all universities with their stats
 */
export const getUniversities = async () => {
    const result = await query(`
    SELECT 
      u.id,
      u.name,
      u.normalized_name,
      u.description,
      u.niche_details,
      u.image_url,
      l.name as location,
      c.name as country,
      COALESCE(s.total_reviews, 0) as review_count,
      COALESCE(s.average_rating, 0) as avg_rating
    FROM universities u
    LEFT JOIN locations l ON u.location_id = l.id
    LEFT JOIN countries c ON l.country_id = c.id
    LEFT JOIN university_stats s ON u.id = s.university_id
    ORDER BY s.total_reviews DESC NULLS LAST, u.name ASC
  `);

    return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        normalizedName: row.normalized_name,
        description: row.description,
        nicheDetails: row.niche_details,
        imageUrl: row.image_url,
        location: row.location,
        country: row.country,
        reviewCount: parseInt(row.review_count),
        avgRating: parseFloat(row.avg_rating) || 0,
    }));
};

/**
 * Get a single university by ID with full stats
 */
export const getUniversityById = async (id) => {
    const result = await query(`
    SELECT 
      u.id,
      u.name,
      u.normalized_name,
      u.description,
      u.niche_details,
      u.image_url,
      l.name as location,
      c.name as country,
      s.*
    FROM universities u
    LEFT JOIN locations l ON u.location_id = l.id
    LEFT JOIN countries c ON l.country_id = c.id
    LEFT JOIN university_stats s ON u.id = s.university_id
    WHERE u.id = $1
  `, [id]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        university: {
            id: row.id,
            name: row.name,
            normalizedName: row.normalized_name,
            description: row.description,
            nicheDetails: row.niche_details,
            imageUrl: row.image_url,
            location: row.location,
            country: row.country,
        },
        stats: {
            universityId: row.id,
            totalReviews: parseInt(row.total_reviews) || 0,
            averageRating: parseFloat(row.average_rating) || 0,
            categoryBreakdown: {
                [Category.ACADEMICS]: { count: row.academics_count || 0, average: parseFloat(row.academics_avg) || 0 },
                [Category.DORMS]: { count: row.dorms_count || 0, average: parseFloat(row.dorms_avg) || 0 },
                [Category.FOOD]: { count: row.food_count || 0, average: parseFloat(row.food_avg) || 0 },
                [Category.SOCIAL]: { count: row.social_count || 0, average: parseFloat(row.social_avg) || 0 },
                [Category.ADMIN]: { count: row.admin_count || 0, average: parseFloat(row.admin_avg) || 0 },
                [Category.COST]: { count: row.cost_count || 0, average: parseFloat(row.cost_avg) || 0 },
                [Category.SAFETY]: { count: row.safety_count || 0, average: parseFloat(row.safety_avg) || 0 },
                [Category.CAREER]: { count: row.career_count || 0, average: parseFloat(row.career_avg) || 0 },
            },
        },
    };
};

/**
 * Find a university by normalized name (for deduplication)
 * Uses AI normalization to find similar universities
 */
export const findUniversityByName = async (name) => {
    const normalizedName = basicNormalize(name);

    // First, try exact normalized match
    const exactMatch = await query(`
    SELECT id, name, normalized_name
    FROM universities
    WHERE normalized_name = $1
  `, [normalizedName]);

    if (exactMatch.rows.length > 0) {
        return exactMatch.rows[0];
    }

    // Try fuzzy match using trigram similarity
    const fuzzyMatch = await query(`
    SELECT id, name, normalized_name, 
           similarity(normalized_name, $1) as sim_score
    FROM universities
    WHERE similarity(normalized_name, $1) > 0.4
    ORDER BY sim_score DESC
    LIMIT 1
  `, [normalizedName]);

    if (fuzzyMatch.rows.length > 0) {
        return fuzzyMatch.rows[0];
    }

    // Check aliases
    const aliasMatch = await query(`
    SELECT u.id, u.name, u.normalized_name
    FROM university_aliases a
    JOIN universities u ON a.university_id = u.id
    WHERE similarity(a.normalized_alias, $1) > 0.4
    ORDER BY similarity(a.normalized_alias, $1) DESC
    LIMIT 1
  `, [normalizedName]);

    if (aliasMatch.rows.length > 0) {
        return aliasMatch.rows[0];
    }

    return null;
};

/**
 * Add a new university or return existing one if duplicate
 * Uses AI to normalize the name and detect duplicates
 */
export const addUniversity = async (data) => {
    // Use AI to normalize the input
    const normalized = await normalizeUniversityInput(data);

    // Check if university already exists
    const existing = await findUniversityByName(normalized.name);
    if (existing) {
        // Add the input name as an alias for better future matching
        await query(`
      INSERT INTO university_aliases (university_id, alias_name, normalized_alias)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `, [existing.id, data.name, basicNormalize(data.name)]);

        return { ...existing, isExisting: true };
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        // Get or create country
        let countryId = null;
        if (normalized.country) {
            const countryResult = await client.query(`
        INSERT INTO countries (name)
        VALUES ($1)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [normalized.country]);
            countryId = countryResult.rows[0].id;
        }

        // Get or create location
        let locationId = null;
        if (normalized.location && countryId) {
            const locationResult = await client.query(`
        INSERT INTO locations (name, country_id)
        VALUES ($1, $2)
        ON CONFLICT (name, country_id) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [normalized.location, countryId]);
            locationId = locationResult.rows[0].id;
        }

        // Insert university
        const uniResult = await client.query(`
      INSERT INTO universities (name, normalized_name, location_id, description, niche_details, image_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, normalized_name
    `, [
            normalized.name,
            normalized.normalizedName,
            locationId,
            normalized.description || data.description || '',
            data.nicheDetails || null,
            data.imageUrl || `https://images.unsplash.com/photo-1562774053-701939374585?w=800&h=400&fit=crop`,
        ]);

        // Initialize stats
        await client.query(`
      INSERT INTO university_stats (university_id)
      VALUES ($1)
      ON CONFLICT DO NOTHING
    `, [uniResult.rows[0].id]);

        await client.query('COMMIT');

        return {
            id: uniResult.rows[0].id,
            name: uniResult.rows[0].name,
            normalizedName: uniResult.rows[0].normalized_name,
            isExisting: false,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// ============================================
// REVIEWS
// ============================================

/**
 * Get reviews for a university
 */
export const getReviewsByUniversity = async (universityId, limit = 50) => {
    const result = await query(`
    SELECT id, university_id, category, rating, comment, created_at
    FROM reviews
    WHERE university_id = $1 AND moderation_status = 'approved'
    ORDER BY created_at DESC
    LIMIT $2
  `, [universityId, limit]);

    return result.rows.map(row => ({
        id: row.id,
        universityId: row.university_id,
        category: row.category,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.created_at,
    }));
};

/**
 * Get all reviews (with optional filtering)
 */
export const getAllReviews = async (limit = 100) => {
    const result = await query(`
    SELECT r.id, r.university_id, r.category, r.rating, r.comment, r.created_at,
           u.name as university_name
    FROM reviews r
    JOIN universities u ON r.university_id = u.id
    WHERE r.moderation_status = 'approved'
    ORDER BY r.created_at DESC
    LIMIT $1
  `, [limit]);

    return result.rows.map(row => ({
        id: row.id,
        universityId: row.university_id,
        universityName: row.university_name,
        category: row.category,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.created_at,
    }));
};

/**
 * Add a new review
 */
export const addReview = async (review) => {
    const result = await query(`
    INSERT INTO reviews (university_id, category, rating, comment, moderation_status)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, university_id, category, rating, comment, created_at
  `, [
        review.universityId,
        review.category,
        review.rating,
        review.comment,
        review.moderationStatus || 'approved',
    ]);

    const row = result.rows[0];
    return {
        id: row.id,
        universityId: row.university_id,
        category: row.category,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.created_at,
    };
};

// ============================================
// STATS
// ============================================

/**
 * Get aggregated stats for a university
 */
export const getAggregatedStats = async (universityId) => {
    const uniData = await getUniversityById(universityId);
    if (!uniData) {
        return {
            universityId,
            totalReviews: 0,
            averageRating: 0,
            categoryBreakdown: {},
        };
    }
    return uniData.stats;
};

// ============================================
// CHAT CACHE
// ============================================

/**
 * Get cached AI response for a query
 */
export const getCachedResponse = async (universityId, queryHash) => {
    const result = await query(`
    SELECT response_text
    FROM chat_cache
    WHERE university_id = $1 AND query_hash = $2 AND expires_at > NOW()
    LIMIT 1
  `, [universityId, queryHash]);

    return result.rows.length > 0 ? result.rows[0].response_text : null;
};

/**
 * Cache an AI response
 */
export const cacheResponse = async (universityId, queryHash, queryText, responseText) => {
    await query(`
    INSERT INTO chat_cache (university_id, query_hash, query_text, response_text)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (university_id, query_hash) 
    DO UPDATE SET response_text = EXCLUDED.response_text, 
                  expires_at = NOW() + INTERVAL '24 hours'
  `, [universityId, queryHash, queryText, responseText]);
};

/**
 * Create a simple hash for query caching
 */
export const hashQuery = (text) => {
    let hash = 0;
    const str = text.toLowerCase().trim();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
};

// ============================================
// RANKINGS
// ============================================

/**
 * Get university rankings grouped by country
 * Each country contains universities sorted by average rating (descending)
 */
export const getRankings = async () => {
    const result = await query(`
    SELECT 
      u.id,
      u.name,
      u.image_url,
      l.name as location,
      c.name as country,
      COALESCE(s.total_reviews, 0) as review_count,
      COALESCE(s.average_rating, 0) as avg_rating,
      COALESCE(s.academics_avg, 0) as academics_avg,
      COALESCE(s.dorms_avg, 0) as dorms_avg,
      COALESCE(s.food_avg, 0) as food_avg,
      COALESCE(s.social_avg, 0) as social_avg,
      COALESCE(s.admin_avg, 0) as admin_avg,
      COALESCE(s.cost_avg, 0) as cost_avg,
      COALESCE(s.safety_avg, 0) as safety_avg,
      COALESCE(s.career_avg, 0) as career_avg
    FROM universities u
    LEFT JOIN locations l ON u.location_id = l.id
    LEFT JOIN countries c ON l.country_id = c.id
    LEFT JOIN university_stats s ON u.id = s.university_id
    WHERE c.name IS NOT NULL
    ORDER BY c.name ASC, s.average_rating DESC NULLS LAST, u.name ASC
  `);

    // Group by country
    const countryMap = new Map();

    for (const row of result.rows) {
        const country = row.country;
        if (!countryMap.has(country)) {
            countryMap.set(country, []);
        }

        countryMap.get(country).push({
            id: row.id,
            name: row.name,
            imageUrl: row.image_url,
            location: row.location,
            reviewCount: parseInt(row.review_count),
            avgRating: parseFloat(row.avg_rating) || 0,
            categories: {
                academics: parseFloat(row.academics_avg) || 0,
                dorms: parseFloat(row.dorms_avg) || 0,
                food: parseFloat(row.food_avg) || 0,
                social: parseFloat(row.social_avg) || 0,
                admin: parseFloat(row.admin_avg) || 0,
                cost: parseFloat(row.cost_avg) || 0,
                safety: parseFloat(row.safety_avg) || 0,
                career: parseFloat(row.career_avg) || 0,
            },
        });
    }

    // Convert to array of country rankings
    const rankings = [];
    for (const [country, universities] of countryMap) {
        rankings.push({ country, universities });
    }

    return rankings;
};
