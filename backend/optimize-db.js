#!/usr/bin/env node

/**
 * Database Optimization Script
 * Applies performance indexes and optimizations to the RateIt database
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const client = new pg.Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function runOptimization() {
    console.log('🔧 RateIt Database Optimization');
    console.log('================================\n');

    try {
        console.log('📦 Connecting to database...');
        console.log(`   Host: ${process.env.DB_HOST}`);
        console.log(`   Database: ${process.env.DB_NAME}\n`);

        await client.connect();
        console.log('✅ Connected successfully\n');

        // Read the optimization SQL file
        const sqlPath = path.join(__dirname, 'database', 'optimize_db.sql');
        console.log(`📄 Reading optimization script from: ${sqlPath}`);

        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by statement for better progress tracking
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));

        console.log(`\n🚀 Executing ${statements.length} optimization statements...\n`);

        let successCount = 0;
        let skipCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];

            // Skip empty or comment-only statements
            if (!statement || statement.length < 5) {
                skipCount++;
                continue;
            }

            try {
                const startTime = Date.now();
                await client.query(statement + ';');
                const duration = Date.now() - startTime;

                // Extract operation type
                const operation = statement.substring(0, 50).replace(/\n/g, ' ');
                console.log(`✅ [${i + 1}/${statements.length}] ${operation}... (${duration}ms)`);
                successCount++;
            } catch (error) {
                // Handle "already exists" errors gracefully
                if (error.message.includes('already exists')) {
                    console.log(`⏭️  [${i + 1}/${statements.length}] Index already exists, skipping...`);
                    skipCount++;
                } else {
                    console.error(`❌ [${i + 1}/${statements.length}] Error:`, error.message);
                }
            }
        }

        console.log('\n================================');
        console.log('📊 Optimization Summary:');
        console.log(`   ✅ Successful: ${successCount}`);
        console.log(`   ⏭️  Skipped: ${skipCount}`);
        console.log(`   📈 Total: ${statements.length}`);

        // Run ANALYZE to update statistics
        console.log('\n🔍 Analyzing tables for query planner...');
        await client.query('ANALYZE');
        console.log('✅ Database statistics updated');

        // Show index information
        console.log('\n📋 Fetching index information...');
        const indexResult = await client.query(`
            SELECT 
                schemaname,
                relname as tablename,
                indexrelname as indexname,
                pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
            FROM pg_stat_user_indexes
            WHERE schemaname = 'public'
            ORDER BY pg_relation_size(indexrelid) DESC
            LIMIT 15;
        `);

        console.log('\n🗄️  Top Indexes:');
        console.table(indexResult.rows);

        // Show table sizes
        const sizeResult = await client.query(`
            SELECT 
                tablename,
                pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS total_size,
                pg_size_pretty(pg_relation_size('public.'||tablename)) AS table_size,
                pg_size_pretty(pg_total_relation_size('public.'||tablename) - pg_relation_size('public.'||tablename)) AS index_size
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size('public.'||tablename) DESC;
        `);

        console.log('\n📊 Table Sizes:');
        console.table(sizeResult.rows);

        console.log('\n✨ Database optimization complete!');
        console.log('\n💡 Next steps:');
        console.log('   1. Monitor query performance in production');
        console.log('   2. Check slow query logs');
        console.log('   3. Run VACUUM ANALYZE periodically');

    } catch (error) {
        console.error('\n❌ Optimization failed:', error);
        process.exit(1);
    } finally {
        await client.end();
        console.log('\n📦 Database connection closed');
    }
}

// Run the optimization
runOptimization().catch(console.error);
