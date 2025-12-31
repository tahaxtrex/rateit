# RATEIT - AI-Powered University Insights

A modern, production-ready MVP for crowdsourced university insights with AI-powered summaries.

![Design: Glassmorphism](https://img.shields.io/badge/Design-Glassmorphism-6c5ce7)
![Frontend: React](https://img.shields.io/badge/Frontend-React%2018-61dafb)
![Backend: Express](https://img.shields.io/badge/Backend-Express.js-000)
![Database: PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791)
![AI: Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285f4)

## Features

- 🎓 **University Directory** - Browse universities with ratings and reviews
- 🤖 **AI Chat** - Ask questions about universities, get answers based on real reviews
- ✍️ **Anonymous Reviews** - Submit honest feedback in multiple categories
- ➕ **Add Schools** - Contribute new universities with niche details
- 🔒 **Content Moderation** - AI-powered filtering of inappropriate content
- 🧠 **Smart Deduplication** - AI normalizes university names to prevent duplicates

## Project Structure

```
rateit---university-insights/
├── frontend/                 # React + Vite + TypeScript
│   └── src/
│       ├── components/       # Glassmorphism UI components
│       ├── pages/            # Home, Ask, Reviews, AddSchool
│       └── services/         # API client
├── backend/
│   ├── database/
│   │   └── schema.sql        # PostgreSQL schema (run this first!)
│   ├── routes/               # API endpoints
│   ├── services/
│   │   ├── database.js       # PostgreSQL connection pool
│   │   ├── dataStore.js      # Data access layer
│   │   └── geminiService.js  # AI integration
│   └── server.js
└── README.md
```

---

## Database Setup (AWS RDS PostgreSQL)

### 1. Create RDS Instance

1. Go to AWS RDS Console
2. Create a PostgreSQL database (version 14+)
3. Note your endpoint, username, and password

### 2. Configure Environment

Edit `backend/.env`:

```env
# Database Configuration
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_PORT=5432
DB_NAME=rateit
DB_USER=your_username
DB_PASSWORD=your_password
DB_SSL=true

# AI Configuration
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Initialize Database

Connect to your RDS and run the schema:

```bash
# Using psql
psql -h your-rds-endpoint.region.rds.amazonaws.com \
     -U your_username \
     -d rateit \
     -f backend/database/schema.sql
```

Or copy-paste the schema.sql contents into a SQL client (DBeaver, pgAdmin, etc.)

---

## Quick Start

### Backend

```bash
cd backend
npm install
node server.js
# Server runs on http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# App runs on http://localhost:3000
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/universities` | GET | List all universities with stats |
| `/api/universities/:id` | GET | Get university with full breakdown |
| `/api/universities` | POST | Add new university (AI deduplication) |
| `/api/reviews` | GET | List reviews (`?universityId=` optional) |
| `/api/reviews` | POST | Submit a review (moderated) |
| `/api/ai/chat` | POST | Get AI insight (cached) |

---

## AI-Powered Deduplication

When users add universities with different spellings:
- "Al Akhawayn University"
- "AUI"
- "al-akhawayn"

The AI normalizes these to the same entry, preventing duplicates.

---

## License

MIT
