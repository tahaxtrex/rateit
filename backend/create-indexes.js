#!/usr/bin/env node

/**
 * Create Performance Indexes
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function createIndexes() {
    const indexes = [
        {
            name: 'idx_reviews_university_created',
            sql: 'CREATE INDEX IF NOT EXISTS idx_reviews_university_created ON reviews(university_id, created_at DESC)',
            desc: 'Reviews by university, sorted by date'
        },
        {
            name: 'idx_reviews_university_category',
            sql: 'CREATE INDEX IF NOT EXISTS idx_reviews_university_category ON reviews(university_id, category)',
            desc: 'Reviews by university and category'
        },
        {
            name: 'idx_universities_location',
            sql: 'CREATE INDEX IF NOT EXISTS idx_universities_location ON universities(location_id)',
            desc: 'Universities by location'
        },
        {
            name: 'idx_stats_rating',
            sql: 'CREATE INDEX IF NOT EXISTS idx_stats_rating ON university_stats(average_rating DESC NULLS LAST)',
            desc: 'University stats sorted by rating'
        },
        {
            name: 'idx_stats_reviews',
            sql: 'CREATE INDEX IF NOT EXISTS idx_stats_reviews ON university_stats(total_reviews DESC NULLS LAST)',
            desc: 'University stats sorted by review count'
        },
        {
            name: 'idx_locations_country',
            sql: 'CREATE INDEX IF NOT EXISTS idx_locations_country ON locations(country_id)',
            desc: 'Locations by country'
        },
        {
            name: 'idx_chat_cache_unique',
            sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_cache_unique ON chat_cache(university_id, query_hash)',
            desc: 'Unique chat cache lookup'
        },
    ];

    console.log('🔧 Creating Performance Indexes\n');
    console.log(`📦 Database: ${process.env.DB_HOST}/${process.env.DB_NAME}\n`);

    try {
        await client.connect();
        console.log('✅ Connected\n');

        for (const idx of indexes) {
            try {
                const start = Date.now();
                await client.query(idx.sql);
                const duration = Date.now() - start;
                console.log(`✅ ${idx.name} (${duration}ms)`);
                console.log(`   ${idx.desc}\n`);
            } catch (err) {
                if (err.message.includes('already exists')) {
                    console.log(`⏭️  ${idx.name} - already exists\n`);
                } else {
                    console.error(`❌ ${idx.name} - ${err.message}\n`);
                }
            }
        }

        console.log('✨ Done!\n');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

createIndexes();
