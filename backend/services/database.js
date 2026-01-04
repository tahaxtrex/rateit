import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Create connection pool
const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
});

// Test connection on startup
pool.on('connect', () => {
    console.log('📦 Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
});

// Query helper with automatic connection handling and performance monitoring
export const query = async (text, params) => {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;

        // Log all queries in development
        if (process.env.NODE_ENV !== 'production') {
            console.log(`⚡ Query executed in ${duration}ms`);
        }

        // Log slow queries in production (>100ms)
        if (process.env.NODE_ENV === 'production' && duration > 100) {
            const queryPreview = text.substring(0, 100).replace(/\s+/g, ' ');
            console.warn(`🐌 Slow query (${duration}ms): ${queryPreview}...`);
        }

        // Log very slow queries everywhere (>500ms)
        if (duration > 500) {
            const queryPreview = text.substring(0, 150).replace(/\s+/g, ' ');
            console.error(`🚨 VERY SLOW QUERY (${duration}ms): ${queryPreview}...`);
            console.error(`   Params:`, params);
        }

        return result;
    } catch (error) {
        console.error('Database query error:', error);
        console.error('Query:', text.substring(0, 200));
        console.error('Params:', params);
        throw error;
    }
};

// Get a client from the pool for transactions
export const getClient = async () => {
    const client = await pool.connect();
    return client;
};

// Close pool (for graceful shutdown)
export const closePool = async () => {
    await pool.end();
    console.log('📦 Database pool closed');
};

export default pool;
