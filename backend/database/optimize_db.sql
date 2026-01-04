-- ============================================
-- RATEIT Database Performance Optimization
-- Migration: Add Performance Indexes
-- ============================================

BEGIN;

-- ============================================
-- 1. COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================

-- Reviews by university with recent first
CREATE INDEX IF NOT EXISTS idx_reviews_university_created 
ON reviews(university_id, created_at DESC);

-- Reviews by university and category
CREATE INDEX IF NOT EXISTS idx_reviews_university_category 
ON reviews(university_id, category);

-- Universities by location
CREATE INDEX IF NOT EXISTS idx_universities_location 
ON universities(location_id);

-- ============================================
-- 2. STATS TABLE OPTIMIZATION
-- ============================================

-- Index for sorting universities by rating
CREATE INDEX IF NOT EXISTS idx_stats_rating 
ON university_stats(average_rating DESC NULLS LAST);

-- Index for sorting by review count
CREATE INDEX IF NOT EXISTS idx_stats_reviews 
ON university_stats(total_reviews DESC NULLS LAST);

-- Locations by country
CREATE INDEX IF NOT EXISTS idx_locations_country 
ON locations(country_id);

-- ============================================
-- 3. CHAT CACHE OPTIMIZATION
-- ============================================

-- Unique constraint for faster lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_cache_unique 
ON chat_cache(university_id, query_hash);

-- Index on expiration for cleanup queries
CREATE INDEX IF NOT EXISTS idx_chat_cache_expires
ON chat_cache(expires_at);

-- ============================================
-- 4. COVERING INDEXES
-- ============================================

-- University list optimization
CREATE INDEX IF NOT EXISTS idx_universities_list 
ON universities(id) 
INCLUDE (name, normalized_name, location_id, image_url);

-- ============================================
-- 5. ANALYZE
-- ============================================

ANALYZE universities;
ANALYZE reviews;
ANALYZE university_stats;
ANALYZE locations;
ANALYZE countries;
ANALYZE chat_cache;

COMMIT;
