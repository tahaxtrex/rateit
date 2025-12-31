// Script to initialize the database with schema.sql
// Run with: node init-db.js

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const { Client } = pg;

async function initDatabase() {
    console.log('🔄 Connecting to database...');
    console.log(`   Host: ${process.env.DB_HOST}`);
    console.log(`   Database: ${process.env.DB_NAME}`);

    const client = new Client({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Read schema file
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('🔄 Running schema...');

        // Split by semicolons but handle functions/triggers properly
        // Execute as single transaction
        await client.query(schema);

        console.log('✅ Schema executed successfully!');
        console.log('');
        console.log('🎉 Database initialization complete!');
        console.log('   Your database is ready to use.');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.message.includes('already exists')) {
            console.log('   (This might be okay if the database was already initialized)');
        }
    } finally {
        await client.end();
    }
}

initDatabase();
