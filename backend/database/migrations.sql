-- ============================================
-- AI Service Optimization Migrations
-- Run after schema.sql
-- ============================================

-- ============================================
-- AI Normalization Cache
-- Caches AI normalization results to avoid duplicate API calls
-- ============================================
CREATE TABLE IF NOT EXISTS ai_normalization_cache (
    input_hash VARCHAR(64) PRIMARY KEY,
    input_text TEXT NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    location VARCHAR(150),
    country VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_ai_norm_cache_expires ON ai_normalization_cache(expires_at);

-- ============================================
-- Global Chat Cache
-- Caches global insight responses by query + region
-- ============================================
CREATE TABLE IF NOT EXISTS global_chat_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_hash VARCHAR(64) NOT NULL,
    region VARCHAR(100),
    query_text TEXT NOT NULL,
    response_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
    UNIQUE(query_hash, region)
);

CREATE INDEX IF NOT EXISTS idx_global_cache_lookup ON global_chat_cache(query_hash, region);
CREATE INDEX IF NOT EXISTS idx_global_cache_expires ON global_chat_cache(expires_at);

-- ============================================
-- Sentiment Summary on university_stats
-- Stores precomputed sentiment digest for token-efficient RAG
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'university_stats' AND column_name = 'sentiment_summary'
    ) THEN
        ALTER TABLE university_stats ADD COLUMN sentiment_summary JSONB;
    END IF;
END $$;

-- ============================================
-- Function to update sentiment summary
-- Computes top themes, sentiment tone from reviews
-- ============================================
CREATE OR REPLACE FUNCTION update_sentiment_summary(uni_id UUID)
RETURNS VOID AS $$
DECLARE
    summary JSONB;
    positive_sample TEXT;
    negative_sample TEXT;
    total_count INTEGER;
    avg_rating DECIMAL;
BEGIN
    -- Get stats
    SELECT total_reviews, average_rating 
    INTO total_count, avg_rating
    FROM university_stats 
    WHERE university_id = uni_id;

    -- Get sample positive reviews (rating >= 4)
    SELECT string_agg(
        LEFT(comment, 80), ' | ' ORDER BY rating DESC, created_at DESC
    )
    INTO positive_sample
    FROM (
        SELECT comment, rating, created_at 
        FROM reviews 
        WHERE university_id = uni_id 
          AND rating >= 4 
          AND moderation_status = 'approved'
        ORDER BY rating DESC, created_at DESC
        LIMIT 3
    ) sub;

    -- Get sample negative reviews (rating <= 2)
    SELECT string_agg(
        LEFT(comment, 80), ' | ' ORDER BY rating ASC, created_at DESC
    )
    INTO negative_sample
    FROM (
        SELECT comment, rating, created_at 
        FROM reviews 
        WHERE university_id = uni_id 
          AND rating <= 2 
          AND moderation_status = 'approved'
        ORDER BY rating ASC, created_at DESC
        LIMIT 3
    ) sub;

    -- Build summary JSON
    summary := jsonb_build_object(
        'tone', CASE 
            WHEN avg_rating >= 4.0 THEN 'positive'
            WHEN avg_rating >= 3.0 THEN 'mixed'
            ELSE 'critical'
        END,
        'positivePhrases', COALESCE(positive_sample, 'No positive reviews yet'),
        'negativePhrases', COALESCE(negative_sample, 'No negative reviews yet'),
        'lastUpdated', NOW()
    );

    -- Update the stats row
    UPDATE university_stats 
    SET sentiment_summary = summary
    WHERE university_id = uni_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Trigger to update sentiment summary on review changes
-- ============================================
CREATE OR REPLACE FUNCTION trigger_update_sentiment()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM update_sentiment_summary(OLD.university_id);
        RETURN OLD;
    ELSE
        PERFORM update_sentiment_summary(NEW.university_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists and recreate
DROP TRIGGER IF EXISTS trg_review_sentiment ON reviews;
CREATE TRIGGER trg_review_sentiment
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION trigger_update_sentiment();

-- ============================================
-- Initialize sentiment summaries for existing universities
-- ============================================
DO $$
DECLARE
    uni RECORD;
BEGIN
    FOR uni IN SELECT university_id FROM university_stats LOOP
        PERFORM update_sentiment_summary(uni.university_id);
    END LOOP;
END $$;

-- ============================================
-- Cleanup old cache entries (run periodically)
-- ============================================
-- DELETE FROM ai_normalization_cache WHERE expires_at < NOW();
-- DELETE FROM global_chat_cache WHERE expires_at < NOW();
