-- ============================================
-- RATEIT Database Schema for AWS RDS PostgreSQL
-- ============================================
-- Run this script to initialize your database
-- psql -h <your-rds-endpoint> -U <username> -d rateit -f schema.sql
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy text matching

-- ============================================
-- ENUMS
-- ============================================

-- Review categories enum
CREATE TYPE review_category AS ENUM (
    'Academics',
    'Dorms & Housing',
    'Food & Dining',
    'Social Life',
    'Administration',
    'Cost of Living',
    'Safety',
    'Career Support',
    'Transportation',
    'Facilities',
    'Student Services',
    'Extracurriculars',
    'Other'
);

-- Moderation status enum
CREATE TYPE moderation_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'flagged'
);

-- ============================================
-- TABLES
-- ============================================

-- Countries table
CREATE TABLE countries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(3),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cities/Locations table
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    country_id UUID REFERENCES countries(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, country_id)
);

-- Universities table
CREATE TABLE universities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,  -- AI-normalized name for deduplication
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    description TEXT,
    niche_details TEXT,  -- Unique/weird insider info
    image_url VARCHAR(500),
    website_url VARCHAR(500),
    established_year INTEGER,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fuzzy matching on university names
CREATE INDEX idx_universities_normalized_name ON universities USING gin (normalized_name gin_trgm_ops);
CREATE INDEX idx_universities_name ON universities USING gin (name gin_trgm_ops);

-- Reviews table
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    category review_category NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL CHECK (char_length(comment) >= 10),
    
    -- Moderation
    moderation_status moderation_status DEFAULT 'approved',
    moderation_reason TEXT,
    
    -- Metadata
    session_hash VARCHAR(64),  -- Anonymous session identifier (hashed)
    ip_hash VARCHAR(64),       -- Hashed IP for spam prevention
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for reviews
CREATE INDEX idx_reviews_university_id ON reviews(university_id);
CREATE INDEX idx_reviews_category ON reviews(category);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_reviews_moderation ON reviews(moderation_status);

-- AI Chat history (optional, for caching responses)
CREATE TABLE chat_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    query_hash VARCHAR(64) NOT NULL,  -- Hash of the query for caching
    query_text TEXT NOT NULL,
    response_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_chat_cache_lookup ON chat_cache(university_id, query_hash);
CREATE INDEX idx_chat_cache_expires ON chat_cache(expires_at);

-- University aliases (for name normalization)
CREATE TABLE university_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    alias_name VARCHAR(255) NOT NULL,
    normalized_alias VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_aliases_normalized ON university_aliases USING gin (normalized_alias gin_trgm_ops);

-- Aggregated stats (materialized view updated periodically)
CREATE TABLE university_stats (
    university_id UUID PRIMARY KEY REFERENCES universities(id) ON DELETE CASCADE,
    total_reviews INTEGER DEFAULT 0,
    average_rating DECIMAL(2,1) DEFAULT 0,
    
    -- Category averages
    academics_avg DECIMAL(2,1),
    academics_count INTEGER DEFAULT 0,
    dorms_avg DECIMAL(2,1),
    dorms_count INTEGER DEFAULT 0,
    food_avg DECIMAL(2,1),
    food_count INTEGER DEFAULT 0,
    social_avg DECIMAL(2,1),
    social_count INTEGER DEFAULT 0,
    admin_avg DECIMAL(2,1),
    admin_count INTEGER DEFAULT 0,
    cost_avg DECIMAL(2,1),
    cost_count INTEGER DEFAULT 0,
    safety_avg DECIMAL(2,1),
    safety_count INTEGER DEFAULT 0,
    career_avg DECIMAL(2,1),
    career_count INTEGER DEFAULT 0,
    
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to normalize university name (basic normalization)
-- The AI normalization is done in the application layer
CREATE OR REPLACE FUNCTION normalize_text(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(
        TRIM(
            REGEXP_REPLACE(
                REGEXP_REPLACE(input_text, '[^\w\s]', '', 'g'),  -- Remove special chars
                '\s+', ' ', 'g'  -- Normalize whitespace
            )
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find similar universities (for deduplication)
CREATE OR REPLACE FUNCTION find_similar_universities(search_name TEXT, threshold FLOAT DEFAULT 0.3)
RETURNS TABLE(
    id UUID,
    name VARCHAR,
    normalized_name VARCHAR,
    similarity_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.name,
        u.normalized_name,
        similarity(u.normalized_name, normalize_text(search_name)) AS similarity_score
    FROM universities u
    WHERE similarity(u.normalized_name, normalize_text(search_name)) > threshold
    ORDER BY similarity_score DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update university stats
CREATE OR REPLACE FUNCTION update_university_stats(uni_id UUID)
RETURNS VOID AS $$
DECLARE
    stats RECORD;
BEGIN
    SELECT 
        COUNT(*) as total,
        COALESCE(AVG(rating), 0) as avg_rating,
        COALESCE(AVG(CASE WHEN category = 'Academics' THEN rating END), NULL) as academics_avg,
        COUNT(CASE WHEN category = 'Academics' THEN 1 END) as academics_count,
        COALESCE(AVG(CASE WHEN category = 'Dorms & Housing' THEN rating END), NULL) as dorms_avg,
        COUNT(CASE WHEN category = 'Dorms & Housing' THEN 1 END) as dorms_count,
        COALESCE(AVG(CASE WHEN category = 'Food & Dining' THEN rating END), NULL) as food_avg,
        COUNT(CASE WHEN category = 'Food & Dining' THEN 1 END) as food_count,
        COALESCE(AVG(CASE WHEN category = 'Social Life' THEN rating END), NULL) as social_avg,
        COUNT(CASE WHEN category = 'Social Life' THEN 1 END) as social_count,
        COALESCE(AVG(CASE WHEN category = 'Administration' THEN rating END), NULL) as admin_avg,
        COUNT(CASE WHEN category = 'Administration' THEN 1 END) as admin_count,
        COALESCE(AVG(CASE WHEN category = 'Cost of Living' THEN rating END), NULL) as cost_avg,
        COUNT(CASE WHEN category = 'Cost of Living' THEN 1 END) as cost_count,
        COALESCE(AVG(CASE WHEN category = 'Safety' THEN rating END), NULL) as safety_avg,
        COUNT(CASE WHEN category = 'Safety' THEN 1 END) as safety_count,
        COALESCE(AVG(CASE WHEN category = 'Career Support' THEN rating END), NULL) as career_avg,
        COUNT(CASE WHEN category = 'Career Support' THEN 1 END) as career_count
    INTO stats
    FROM reviews
    WHERE university_id = uni_id AND moderation_status = 'approved';

    INSERT INTO university_stats (
        university_id, total_reviews, average_rating,
        academics_avg, academics_count,
        dorms_avg, dorms_count,
        food_avg, food_count,
        social_avg, social_count,
        admin_avg, admin_count,
        cost_avg, cost_count,
        safety_avg, safety_count,
        career_avg, career_count,
        last_updated
    ) VALUES (
        uni_id, stats.total, ROUND(stats.avg_rating::numeric, 1),
        ROUND(stats.academics_avg::numeric, 1), stats.academics_count,
        ROUND(stats.dorms_avg::numeric, 1), stats.dorms_count,
        ROUND(stats.food_avg::numeric, 1), stats.food_count,
        ROUND(stats.social_avg::numeric, 1), stats.social_count,
        ROUND(stats.admin_avg::numeric, 1), stats.admin_count,
        ROUND(stats.cost_avg::numeric, 1), stats.cost_count,
        ROUND(stats.safety_avg::numeric, 1), stats.safety_count,
        ROUND(stats.career_avg::numeric, 1), stats.career_count,
        NOW()
    )
    ON CONFLICT (university_id) DO UPDATE SET
        total_reviews = EXCLUDED.total_reviews,
        average_rating = EXCLUDED.average_rating,
        academics_avg = EXCLUDED.academics_avg,
        academics_count = EXCLUDED.academics_count,
        dorms_avg = EXCLUDED.dorms_avg,
        dorms_count = EXCLUDED.dorms_count,
        food_avg = EXCLUDED.food_avg,
        food_count = EXCLUDED.food_count,
        social_avg = EXCLUDED.social_avg,
        social_count = EXCLUDED.social_count,
        admin_avg = EXCLUDED.admin_avg,
        admin_count = EXCLUDED.admin_count,
        cost_avg = EXCLUDED.cost_avg,
        cost_count = EXCLUDED.cost_count,
        safety_avg = EXCLUDED.safety_avg,
        safety_count = EXCLUDED.safety_count,
        career_avg = EXCLUDED.career_avg,
        career_count = EXCLUDED.career_count,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to update stats after review insert/update/delete
CREATE OR REPLACE FUNCTION trigger_update_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM update_university_stats(OLD.university_id);
        RETURN OLD;
    ELSE
        PERFORM update_university_stats(NEW.university_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_review_stats
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION trigger_update_stats();

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION trigger_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_universities_timestamp
BEFORE UPDATE ON universities
FOR EACH ROW
EXECUTE FUNCTION trigger_update_timestamp();

CREATE TRIGGER trg_reviews_timestamp
BEFORE UPDATE ON reviews
FOR EACH ROW
EXECUTE FUNCTION trigger_update_timestamp();

-- ============================================
-- SEED DATA
-- ============================================

-- Insert default countries
INSERT INTO countries (name, code) VALUES
    ('Morocco', 'MA'),
    ('Uzbekistan', 'UZ'),
    ('Kenya', 'KE'),
    ('Nigeria', 'NG'),
    ('Egypt', 'EG'),
    ('South Africa', 'ZA'),
    ('India', 'IN'),
    ('Pakistan', 'PK'),
    ('Bangladesh', 'BD'),
    ('Indonesia', 'ID')
ON CONFLICT (name) DO NOTHING;

-- Insert sample locations
INSERT INTO locations (name, country_id)
SELECT 'Ifrane', id FROM countries WHERE name = 'Morocco'
ON CONFLICT DO NOTHING;

INSERT INTO locations (name, country_id)
SELECT 'Tashkent', id FROM countries WHERE name = 'Uzbekistan'
ON CONFLICT DO NOTHING;

INSERT INTO locations (name, country_id)
SELECT 'Nairobi', id FROM countries WHERE name = 'Kenya'
ON CONFLICT DO NOTHING;

-- Insert sample universities
INSERT INTO universities (name, normalized_name, location_id, description, image_url)
SELECT 
    'Al Akhawayn University',
    normalize_text('Al Akhawayn University'),
    l.id,
    'An independent, public, not-for-profit, coeducational university committed to educating future leaders of Morocco and the world.',
    'https://images.unsplash.com/photo-1562774053-701939374585?w=800&h=400&fit=crop'
FROM locations l
JOIN countries c ON l.country_id = c.id
WHERE l.name = 'Ifrane' AND c.name = 'Morocco';

INSERT INTO universities (name, normalized_name, location_id, description, image_url)
SELECT 
    'Westminster International University in Tashkent',
    normalize_text('Westminster International University in Tashkent'),
    l.id,
    'The first international university in Uzbekistan to offer a Western-style education with UK qualifications.',
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&h=400&fit=crop'
FROM locations l
JOIN countries c ON l.country_id = c.id
WHERE l.name = 'Tashkent' AND c.name = 'Uzbekistan';

INSERT INTO universities (name, normalized_name, location_id, description, image_url)
SELECT 
    'University of Nairobi',
    normalize_text('University of Nairobi'),
    l.id,
    'A collegiate research university based in Nairobi. It is one of the largest universities in Kenya.',
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=400&fit=crop'
FROM locations l
JOIN countries c ON l.country_id = c.id
WHERE l.name = 'Nairobi' AND c.name = 'Kenya';

-- Insert sample reviews
DO $$
DECLARE
    aui_id UUID;
    wiut_id UUID;
    uon_id UUID;
BEGIN
    SELECT id INTO aui_id FROM universities WHERE name LIKE 'Al Akhawayn%';
    SELECT id INTO wiut_id FROM universities WHERE name LIKE 'Westminster%';
    SELECT id INTO uon_id FROM universities WHERE name LIKE 'University of Nairobi%';

    -- Al Akhawayn reviews
    IF aui_id IS NOT NULL THEN
        INSERT INTO reviews (university_id, category, rating, comment) VALUES
            (aui_id, 'Dorms & Housing', 5, 'The heating in the dorms is excellent, which is vital for Ifrane winters. Very clean and well-maintained.'),
            (aui_id, 'Food & Dining', 2, 'The cafeteria food is repetitive. Most students cook or eat out at local restaurants.'),
            (aui_id, 'Academics', 4, 'Professors are accessible, but the workload is intense compared to public universities.'),
            (aui_id, 'Social Life', 3, 'Small community. Everyone knows everyone. Can be good or bad depending on your personality.');
    END IF;

    -- Westminster reviews
    IF wiut_id IS NOT NULL THEN
        INSERT INTO reviews (university_id, category, rating, comment) VALUES
            (wiut_id, 'Administration', 2, 'Bureaucracy is slow. Getting transcripts takes weeks. Plan ahead for any paperwork.'),
            (wiut_id, 'Academics', 5, 'The British curriculum is rigorous. Best English instruction in the city by far.'),
            (wiut_id, 'Cost of Living', 3, 'Tuition is high for the region, but ROI is good for jobs in international companies.');
    END IF;

    -- University of Nairobi reviews
    IF uon_id IS NOT NULL THEN
        INSERT INTO reviews (university_id, category, rating, comment) VALUES
            (uon_id, 'Social Life', 5, 'Nairobi vibe is unmatched. Campus life is vibrant and political. Great networking.'),
            (uon_id, 'Safety', 2, 'Avoid walking alone near the hostels at night. Use campus security escorts.');
    END IF;
END $$;

-- Initialize stats for seeded universities
DO $$
DECLARE
    uni RECORD;
BEGIN
    FOR uni IN SELECT id FROM universities LOOP
        PERFORM update_university_stats(uni.id);
    END LOOP;
END $$;

-- ============================================
-- CLEANUP OLD CACHE (can be run periodically)
-- ============================================
-- DELETE FROM chat_cache WHERE expires_at < NOW();

-- ============================================
-- GRANTS (adjust as needed for your RDS user)
-- ============================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;

COMMIT;
