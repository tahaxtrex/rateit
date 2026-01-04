// Run AI optimization migrations
// Usage: node run-migrations.js

import { query, closePool } from './services/database.js';

async function runMigrations() {
    console.log('🚀 Running AI optimization migrations...\n');

    try {
        // ============================================
        // 1. Create AI normalization cache table
        // ============================================
        console.log('Creating ai_normalization_cache table...');
        await query(`
            CREATE TABLE IF NOT EXISTS ai_normalization_cache (
                input_hash VARCHAR(64) PRIMARY KEY,
                input_text TEXT NOT NULL,
                normalized_name VARCHAR(255) NOT NULL,
                display_name VARCHAR(255),
                location VARCHAR(150),
                country VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days'
            )
        `);
        console.log('  ✅ ai_normalization_cache table created');

        await query(`CREATE INDEX IF NOT EXISTS idx_ai_norm_cache_expires ON ai_normalization_cache(expires_at)`);
        console.log('  ✅ idx_ai_norm_cache_expires index created');

        // ============================================
        // 2. Create global chat cache table
        // ============================================
        console.log('Creating global_chat_cache table...');
        await query(`
            CREATE TABLE IF NOT EXISTS global_chat_cache (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                query_hash VARCHAR(64) NOT NULL,
                region VARCHAR(100),
                query_text TEXT NOT NULL,
                response_text TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
                UNIQUE(query_hash, region)
            )
        `);
        console.log('  ✅ global_chat_cache table created');

        await query(`CREATE INDEX IF NOT EXISTS idx_global_cache_lookup ON global_chat_cache(query_hash, region)`);
        console.log('  ✅ idx_global_cache_lookup index created');

        await query(`CREATE INDEX IF NOT EXISTS idx_global_cache_expires ON global_chat_cache(expires_at)`);
        console.log('  ✅ idx_global_cache_expires index created');

        // ============================================
        // 3. Add sentiment_summary column to university_stats
        // ============================================
        console.log('Adding sentiment_summary column...');
        try {
            await query(`ALTER TABLE university_stats ADD COLUMN IF NOT EXISTS sentiment_summary JSONB`);
            console.log('  ✅ sentiment_summary column added');
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log('  ⏭️  sentiment_summary column already exists');
            } else {
                throw err;
            }
        }

        // ============================================
        // 4. Create update_sentiment_summary function
        // ============================================
        console.log('Creating update_sentiment_summary function...');
        await query(`
            CREATE OR REPLACE FUNCTION update_sentiment_summary(uni_id UUID)
            RETURNS VOID AS $$
            DECLARE
                summary JSONB;
                positive_sample TEXT;
                negative_sample TEXT;
                total_count INTEGER;
                avg_rating DECIMAL;
            BEGIN
                SELECT total_reviews, average_rating 
                INTO total_count, avg_rating
                FROM university_stats 
                WHERE university_id = uni_id;

                SELECT string_agg(LEFT(comment, 80), ' | ' ORDER BY rating DESC, created_at DESC)
                INTO positive_sample
                FROM (
                    SELECT comment, rating, created_at 
                    FROM reviews 
                    WHERE university_id = uni_id AND rating >= 4 AND moderation_status = 'approved'
                    ORDER BY rating DESC, created_at DESC
                    LIMIT 3
                ) sub;

                SELECT string_agg(LEFT(comment, 80), ' | ' ORDER BY rating ASC, created_at DESC)
                INTO negative_sample
                FROM (
                    SELECT comment, rating, created_at 
                    FROM reviews 
                    WHERE university_id = uni_id AND rating <= 2 AND moderation_status = 'approved'
                    ORDER BY rating ASC, created_at DESC
                    LIMIT 3
                ) sub;

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

                UPDATE university_stats 
                SET sentiment_summary = summary
                WHERE university_id = uni_id;
            END;
            $$ LANGUAGE plpgsql
        `);
        console.log('  ✅ update_sentiment_summary function created');

        // ============================================
        // 5. Create trigger function
        // ============================================
        console.log('Creating trigger function...');
        await query(`
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
            $$ LANGUAGE plpgsql
        `);
        console.log('  ✅ trigger_update_sentiment function created');

        // ============================================
        // 6. Create trigger
        // ============================================
        console.log('Creating trigger...');
        await query(`DROP TRIGGER IF EXISTS trg_review_sentiment ON reviews`);
        await query(`
            CREATE TRIGGER trg_review_sentiment
            AFTER INSERT OR UPDATE OR DELETE ON reviews
            FOR EACH ROW
            EXECUTE FUNCTION trigger_update_sentiment()
        `);
        console.log('  ✅ trg_review_sentiment trigger created');

        // ============================================
        // 7. Initialize sentiment summaries for existing universities
        // ============================================
        console.log('Initializing sentiment summaries for existing universities...');
        const universities = await query(`SELECT university_id FROM university_stats`);
        for (const row of universities.rows) {
            await query(`SELECT update_sentiment_summary($1)`, [row.university_id]);
        }
        console.log(`  ✅ Initialized ${universities.rows.length} university sentiment summaries`);

        console.log('\n✨ All migrations completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await closePool();
    }
}

runMigrations();
