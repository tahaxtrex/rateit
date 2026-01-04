// Database-backed data store for RateIt
// Connects to PostgreSQL (AWS RDS) and handles all data operations

import { query, getClient } from './database.js';
import { normalizeUniversityInput, basicNormalize, isAmbiguousInput } from './geminiService.js';

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    SIMILARITY_THRESHOLD: 0.7,           // High confidence match threshold
    SIMILARITY_THRESHOLD_LOW: 0.4,       // Low confidence threshold (needs AI)
    MAX_CANDIDATES_GLOBAL: 5,            // Max candidates for global insight
};

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
      COALESCE(s.average_rating, 0) as avg_rating,
      s.sentiment_summary
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
        sentimentSummary: row.sentiment_summary,
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
            sentimentSummary: row.sentiment_summary,
        },
    };
};

/**
 * Find similar universities with confidence score
 * Returns matches above the threshold with similarity scores
 */
export const findSimilarWithConfidence = async (normalizedName, threshold = CONFIG.SIMILARITY_THRESHOLD) => {
    const result = await query(`
    SELECT id, name, normalized_name, 
           similarity(normalized_name, $1) as sim_score
    FROM universities
    WHERE similarity(normalized_name, $1) > $2
    ORDER BY sim_score DESC
    LIMIT 5
  `, [normalizedName, threshold]);

    return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        normalizedName: row.normalized_name,
        similarity: parseFloat(row.sim_score),
    }));
};

/**
 * Find a university by normalized name (legacy - uses new two-phase approach)
 */
export const findUniversityByName = async (name) => {
    const normalizedName = basicNormalize(name);

    // Phase 1: Try high-confidence match first
    const highConfidence = await findSimilarWithConfidence(normalizedName, CONFIG.SIMILARITY_THRESHOLD);
    if (highConfidence.length > 0 && highConfidence[0].similarity >= CONFIG.SIMILARITY_THRESHOLD) {
        console.log(`[DataStore] High-confidence match found: ${highConfidence[0].name} (${highConfidence[0].similarity})`);
        return highConfidence[0];
    }

    // Phase 2: Try low-confidence match
    const lowConfidence = await findSimilarWithConfidence(normalizedName, CONFIG.SIMILARITY_THRESHOLD_LOW);
    if (lowConfidence.length > 0) {
        console.log(`[DataStore] Low-confidence match found: ${lowConfidence[0].name} (${lowConfidence[0].similarity})`);
        return lowConfidence[0];
    }

    // Check aliases
    const aliasMatch = await query(`
    SELECT u.id, u.name, u.normalized_name,
           similarity(a.normalized_alias, $1) as sim_score
    FROM university_aliases a
    JOIN universities u ON a.university_id = u.id
    WHERE similarity(a.normalized_alias, $1) > $2
    ORDER BY sim_score DESC
    LIMIT 1
  `, [normalizedName, CONFIG.SIMILARITY_THRESHOLD_LOW]);

    if (aliasMatch.rows.length > 0) {
        console.log(`[DataStore] Alias match found: ${aliasMatch.rows[0].name}`);
        return aliasMatch.rows[0];
    }

    return null;
};

// ============================================
// AI NORMALIZATION CACHE
// ============================================

/**
 * Get cached AI normalization result
 */
export const getAINormalizationCache = async (inputHash) => {
    try {
        const result = await query(`
      SELECT normalized_name, display_name, location, country
      FROM ai_normalization_cache
      WHERE input_hash = $1 AND expires_at > NOW()
      LIMIT 1
    `, [inputHash]);

        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        // Table might not exist yet
        console.warn('[DataStore] AI normalization cache lookup failed:', error.message);
        return null;
    }
};

/**
 * Cache AI normalization result
 */
export const setAINormalizationCache = async (inputHash, inputText, normalized) => {
    try {
        await query(`
      INSERT INTO ai_normalization_cache (input_hash, input_text, normalized_name, display_name, location, country)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (input_hash) DO UPDATE SET
        normalized_name = EXCLUDED.normalized_name,
        display_name = EXCLUDED.display_name,
        expires_at = NOW() + INTERVAL '7 days'
    `, [inputHash, inputText, normalized.normalizedName, normalized.name, normalized.location, normalized.country]);
    } catch (error) {
        console.warn('[DataStore] AI normalization cache write failed:', error.message);
    }
};

/**
 * Add a new university or return existing one if duplicate
 * Uses two-phase resolution: deterministic first, AI only for ambiguous inputs
 */
export const addUniversity = async (data) => {
    const inputName = data.name;
    const deterministicNorm = basicNormalize(inputName);

    // ============================================
    // PHASE 1: Deterministic matching (no AI)
    // ============================================
    console.log(`[DataStore] Phase 1: Deterministic matching for "${inputName}" -> "${deterministicNorm}"`);

    // Check for high-confidence match
    const highConfidence = await findSimilarWithConfidence(deterministicNorm, CONFIG.SIMILARITY_THRESHOLD);
    if (highConfidence.length > 0 && highConfidence[0].similarity >= CONFIG.SIMILARITY_THRESHOLD) {
        console.log(`[DataStore] High-confidence match found, skipping AI: ${highConfidence[0].name}`);

        // Add alias for future matching
        await addAlias(highConfidence[0].id, inputName, deterministicNorm);

        return { ...highConfidence[0], isExisting: true };
    }

    // ============================================
    // PHASE 2: AI resolution (only for ambiguous inputs)
    // ============================================
    const needsAI = isAmbiguousInput(inputName);
    let normalized;

    if (needsAI) {
        console.log(`[DataStore] Phase 2: Input is ambiguous, using AI normalization`);

        // Check AI cache first
        const inputHash = hashQuery(inputName.toLowerCase().trim());
        const cached = await getAINormalizationCache(inputHash);

        if (cached) {
            console.log(`[DataStore] Using cached AI normalization result`);
            normalized = {
                normalizedName: cached.normalized_name,
                name: cached.display_name || inputName,
                location: cached.location || data.location,
                country: cached.country || data.country,
                description: data.description,
                usedAI: true,
            };
        } else {
            // Call AI
            normalized = await normalizeUniversityInput(data);

            // Cache the result
            if (normalized.usedAI) {
                await setAINormalizationCache(inputHash, inputName, normalized);
            }
        }

        // After AI resolution, do SECOND similarity lookup
        console.log(`[DataStore] Phase 2b: Second similarity lookup after AI: "${normalized.normalizedName}"`);
        const postAIMatch = await findSimilarWithConfidence(normalized.normalizedName, CONFIG.SIMILARITY_THRESHOLD_LOW);

        if (postAIMatch.length > 0) {
            console.log(`[DataStore] Match found after AI resolution: ${postAIMatch[0].name}`);

            // Add both original and AI-normalized as aliases
            await addAlias(postAIMatch[0].id, inputName, deterministicNorm);
            if (normalized.normalizedName !== deterministicNorm) {
                await addAlias(postAIMatch[0].id, normalized.name, normalized.normalizedName);
            }

            return { ...postAIMatch[0], isExisting: true };
        }
    } else {
        console.log(`[DataStore] Input is not ambiguous, skipping AI`);
        normalized = {
            normalizedName: deterministicNorm,
            name: inputName,
            location: data.location,
            country: data.country,
            description: data.description,
            usedAI: false,
        };

        // Check low-confidence matches before creating new
        const lowConfidence = await findSimilarWithConfidence(deterministicNorm, CONFIG.SIMILARITY_THRESHOLD_LOW);
        if (lowConfidence.length > 0) {
            console.log(`[DataStore] Low-confidence match found: ${lowConfidence[0].name}`);
            await addAlias(lowConfidence[0].id, inputName, deterministicNorm);
            return { ...lowConfidence[0], isExisting: true };
        }
    }

    // ============================================
    // PHASE 3: Create new university (no match found)
    // ============================================
    console.log(`[DataStore] Phase 3: Creating new university: "${normalized.name}"`);

    const client = await getClient();
    try {
        await client.query('BEGIN');

        // Get or create country
        let countryId = null;
        if (normalized.country || data.country) {
            const countryResult = await client.query(`
        INSERT INTO countries (name)
        VALUES ($1)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [normalized.country || data.country]);
            countryId = countryResult.rows[0].id;
        }

        // Get or create location
        let locationId = null;
        if ((normalized.location || data.location) && countryId) {
            const locationResult = await client.query(`
        INSERT INTO locations (name, country_id)
        VALUES ($1, $2)
        ON CONFLICT (name, country_id) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [normalized.location || data.location, countryId]);
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

/**
 * Add an alias for a university
 */
const addAlias = async (universityId, aliasName, normalizedAlias) => {
    try {
        await query(`
      INSERT INTO university_aliases (university_id, alias_name, normalized_alias)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `, [universityId, aliasName, normalizedAlias]);
    } catch (error) {
        console.warn('[DataStore] Failed to add alias:', error.message);
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
            sentimentSummary: null,
        };
    }
    return uniData.stats;
};

/**
 * Get sentiment summary for a university
 */
export const getSentimentSummary = async (universityId) => {
    const result = await query(`
    SELECT sentiment_summary
    FROM university_stats
    WHERE university_id = $1
  `, [universityId]);

    return result.rows.length > 0 ? result.rows[0].sentiment_summary : null;
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
 * Get cached global chat response
 */
export const getCachedGlobalResponse = async (queryHash, region = null) => {
    try {
        const result = await query(`
      SELECT response_text
      FROM global_chat_cache
      WHERE query_hash = $1 AND (region = $2 OR (region IS NULL AND $2 IS NULL)) AND expires_at > NOW()
      LIMIT 1
    `, [queryHash, region]);

        return result.rows.length > 0 ? result.rows[0].response_text : null;
    } catch (error) {
        console.warn('[DataStore] Global cache lookup failed:', error.message);
        return null;
    }
};

/**
 * Cache a global chat response
 */
export const cacheGlobalResponse = async (queryHash, queryText, responseText, region = null) => {
    try {
        await query(`
      INSERT INTO global_chat_cache (query_hash, region, query_text, response_text)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (query_hash, region) 
      DO UPDATE SET response_text = EXCLUDED.response_text, 
                    expires_at = NOW() + INTERVAL '24 hours'
    `, [queryHash, region, queryText, responseText]);
    } catch (error) {
        console.warn('[DataStore] Global cache write failed:', error.message);
    }
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
// PRE-RANKING FOR GLOBAL INSIGHTS
// ============================================

/**
 * Pre-rank universities for global insight queries
 * Returns top candidates based on relevance, rating, and review count
 */
export const preRankUniversities = async (queryText, region = null) => {
    // Extract potential keywords from query
    const keywords = queryText.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2);

    const keywordPatterns = keywords.map(k => `%${k}%`);
    // Ensure we always have at least one pattern to avoid empty array issues
    const patterns = keywordPatterns.length > 0 ? keywordPatterns : ['%%'];

    // Build query with explicit region handling to avoid parameter type inference issues
    let sql, params;

    if (region) {
        // Region-specific query
        sql = `
        SELECT 
          u.id,
          u.name,
          u.normalized_name,
          u.description,
          l.name as location,
          c.name as country,
          COALESCE(s.total_reviews, 0) as review_count,
          COALESCE(s.average_rating, 0) as avg_rating,
          s.sentiment_summary,
          (
            COALESCE(s.average_rating, 0) * 0.4 +
            LEAST(COALESCE(s.total_reviews, 0) / 10.0, 2) * 0.3 +
            CASE WHEN c.name ILIKE $1 THEN 1.5 ELSE 0 END +
            CASE WHEN u.name ILIKE ANY($2::text[]) OR u.description ILIKE ANY($2::text[]) THEN 1.0 ELSE 0 END
          ) as relevance_score
        FROM universities u
        LEFT JOIN locations l ON u.location_id = l.id
        LEFT JOIN countries c ON l.country_id = c.id
        LEFT JOIN university_stats s ON u.id = s.university_id
        WHERE COALESCE(s.total_reviews, 0) > 0
        ORDER BY relevance_score DESC, s.average_rating DESC NULLS LAST
        LIMIT $3
      `;
        params = [`%${region}%`, patterns, CONFIG.MAX_CANDIDATES_GLOBAL];
    } else {
        // Global query (no region filter)
        sql = `
        SELECT 
          u.id,
          u.name,
          u.normalized_name,
          u.description,
          l.name as location,
          c.name as country,
          COALESCE(s.total_reviews, 0) as review_count,
          COALESCE(s.average_rating, 0) as avg_rating,
          s.sentiment_summary,
          (
            COALESCE(s.average_rating, 0) * 0.4 +
            LEAST(COALESCE(s.total_reviews, 0) / 10.0, 2) * 0.3 +
            CASE WHEN u.name ILIKE ANY($1::text[]) OR u.description ILIKE ANY($1::text[]) THEN 1.0 ELSE 0 END
          ) as relevance_score
        FROM universities u
        LEFT JOIN locations l ON u.location_id = l.id
        LEFT JOIN countries c ON l.country_id = c.id
        LEFT JOIN university_stats s ON u.id = s.university_id
        WHERE COALESCE(s.total_reviews, 0) > 0
        ORDER BY relevance_score DESC, s.average_rating DESC NULLS LAST
        LIMIT $2
      `;
        params = [patterns, CONFIG.MAX_CANDIDATES_GLOBAL];
    }

    const result = await query(sql, params);

    return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        normalizedName: row.normalized_name,
        description: row.description,
        location: row.location,
        country: row.country,
        reviewCount: parseInt(row.review_count),
        avgRating: parseFloat(row.avg_rating) || 0,
        sentimentSummary: row.sentiment_summary,
        relevanceScore: parseFloat(row.relevance_score) || 0,
    }));
};

// ============================================
// RANKINGS
// ============================================

/**
 * Get university rankings grouped by country
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
