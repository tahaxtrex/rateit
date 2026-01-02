import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import universitiesRouter from './routes/universities.js';
import reviewsRouter from './routes/reviews.js';
import aiRouter from './routes/ai.js';
import { closePool } from './services/database.js';
import { getRankings } from './services/dataStore.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: '*', // Allow anyone for now (we will lock this down later)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());



// API Routes
app.use('/api/universities', universitiesRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/ai', aiRouter);

// Rankings endpoint
app.get('/api/rankings', async (req, res) => {
    try {
        const rankings = await getRankings();
        res.json(rankings);
    } catch (error) {
        console.error('Error fetching rankings:', error);
        res.status(500).json({ error: 'Failed to fetch rankings' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await closePool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await closePool();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`🚀 RateIt Backend running on http://localhost:${PORT}`);
    console.log(`📦 Database: ${process.env.DB_HOST || 'Not configured'}`);
});
