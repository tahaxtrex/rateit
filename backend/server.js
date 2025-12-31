import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import universitiesRouter from './routes/universities.js';
import reviewsRouter from './routes/reviews.js';
import aiRouter from './routes/ai.js';
import { closePool } from './services/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/universities', universitiesRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/ai', aiRouter);

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
