// RateIt Admin Dashboard Server
// Runs on port 3002, provides CRUD operations for universities and reviews

import express from 'express';
import cors from 'cors';
import { query, getClient, closePool } from './services/database.js';

const app = express();
const PORT = process.env.ADMIN_PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// UNIVERSITIES ADMIN API
// ============================================

// GET all universities with full details
app.get('/api/admin/universities', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                u.id,
                u.name,
                u.normalized_name,
                u.description,
                u.niche_details,
                u.image_url,
                u.website_url,
                u.established_year,
                u.is_verified,
                u.created_at,
                u.updated_at,
                l.id as location_id,
                l.name as location,
                c.id as country_id,
                c.name as country,
                COALESCE(s.total_reviews, 0) as review_count,
                COALESCE(s.average_rating, 0) as avg_rating
            FROM universities u
            LEFT JOIN locations l ON u.location_id = l.id
            LEFT JOIN countries c ON l.country_id = c.id
            LEFT JOIN university_stats s ON u.id = s.university_id
            ORDER BY u.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching universities:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET single university
app.get('/api/admin/universities/:id', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                u.*,
                l.name as location,
                c.name as country,
                s.*
            FROM universities u
            LEFT JOIN locations l ON u.location_id = l.id
            LEFT JOIN countries c ON l.country_id = c.id
            LEFT JOIN university_stats s ON u.id = s.university_id
            WHERE u.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'University not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE university
app.put('/api/admin/universities/:id', async (req, res) => {
    const { name, normalized_name, description, niche_details, image_url, website_url, established_year, is_verified, location, country } = req.body;
    const client = await getClient();

    try {
        await client.query('BEGIN');

        // Update or create country/location if provided
        let locationId = null;
        if (country && location) {
            const countryResult = await client.query(`
                INSERT INTO countries (name) VALUES ($1)
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
            `, [country]);

            const locationResult = await client.query(`
                INSERT INTO locations (name, country_id) VALUES ($1, $2)
                ON CONFLICT (name, country_id) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
            `, [location, countryResult.rows[0].id]);

            locationId = locationResult.rows[0].id;
        }

        const result = await client.query(`
            UPDATE universities SET
                name = COALESCE($1, name),
                normalized_name = COALESCE($2, normalized_name),
                description = COALESCE($3, description),
                niche_details = COALESCE($4, niche_details),
                image_url = COALESCE($5, image_url),
                website_url = COALESCE($6, website_url),
                established_year = COALESCE($7, established_year),
                is_verified = COALESCE($8, is_verified),
                location_id = COALESCE($9, location_id),
                updated_at = NOW()
            WHERE id = $10
            RETURNING *
        `, [name, normalized_name, description, niche_details, image_url, website_url, established_year, is_verified, locationId, req.params.id]);

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// DELETE university
app.delete('/api/admin/universities/:id', async (req, res) => {
    try {
        await query('DELETE FROM universities WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'University deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// REVIEWS ADMIN API
// ============================================

// GET all reviews with university names
app.get('/api/admin/reviews', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                r.*,
                u.name as university_name
            FROM reviews r
            JOIN universities u ON r.university_id = u.id
            ORDER BY r.created_at DESC
            LIMIT 500
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET reviews for a university
app.get('/api/admin/universities/:id/reviews', async (req, res) => {
    try {
        const result = await query(`
            SELECT * FROM reviews 
            WHERE university_id = $1 
            ORDER BY created_at DESC
        `, [req.params.id]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE review
app.put('/api/admin/reviews/:id', async (req, res) => {
    const { category, rating, comment, moderation_status, moderation_reason } = req.body;

    try {
        const result = await query(`
            UPDATE reviews SET
                category = COALESCE($1, category),
                rating = COALESCE($2, rating),
                comment = COALESCE($3, comment),
                moderation_status = COALESCE($4, moderation_status),
                moderation_reason = COALESCE($5, moderation_reason),
                updated_at = NOW()
            WHERE id = $6
            RETURNING *
        `, [category, rating, comment, moderation_status, moderation_reason, req.params.id]);

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE review
app.delete('/api/admin/reviews/:id', async (req, res) => {
    try {
        // Get university_id before deleting for stats update
        const review = await query('SELECT university_id FROM reviews WHERE id = $1', [req.params.id]);
        await query('DELETE FROM reviews WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Review deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CREATE review (admin can add reviews directly)
app.post('/api/admin/reviews', async (req, res) => {
    const { university_id, category, rating, comment, moderation_status } = req.body;

    try {
        const result = await query(`
            INSERT INTO reviews (university_id, category, rating, comment, moderation_status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [university_id, category, rating, comment, moderation_status || 'approved']);

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// STATS API
// ============================================

app.get('/api/admin/stats', async (req, res) => {
    try {
        const stats = await query(`
            SELECT 
                (SELECT COUNT(*) FROM universities) as total_universities,
                (SELECT COUNT(*) FROM reviews) as total_reviews,
                (SELECT COUNT(*) FROM reviews WHERE moderation_status = 'pending') as pending_reviews,
                (SELECT COUNT(*) FROM reviews WHERE moderation_status = 'approved') as approved_reviews,
                (SELECT COUNT(*) FROM reviews WHERE moderation_status = 'rejected') as rejected_reviews,
                (SELECT COUNT(*) FROM countries) as total_countries,
                (SELECT AVG(average_rating) FROM university_stats WHERE total_reviews > 0) as overall_avg_rating
        `);
        res.json(stats.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// COUNTRIES/LOCATIONS API
// ============================================

app.get('/api/admin/countries', async (req, res) => {
    try {
        const result = await query('SELECT * FROM countries ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/locations', async (req, res) => {
    try {
        const result = await query(`
            SELECT l.*, c.name as country_name 
            FROM locations l 
            JOIN countries c ON l.country_id = c.id 
            ORDER BY c.name, l.name
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// SERVE ADMIN UI
// ============================================

app.get('/', (req, res) => {
    res.send(ADMIN_HTML);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down admin server...');
    await closePool();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`🔧 RateIt Admin Dashboard running on http://localhost:${PORT}`);
});

// ============================================
// ADMIN UI HTML
// ============================================

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RateIt Admin Dashboard</title>
    <style>
        :root {
            --bg-primary: #0f0f1a;
            --bg-secondary: #1a1a2e;
            --bg-tertiary: #25253d;
            --accent: #6366f1;
            --accent-hover: #818cf8;
            --text-primary: #f0f0f5;
            --text-secondary: #a0a0b0;
            --success: #22c55e;
            --warning: #f59e0b;
            --danger: #ef4444;
            --border: rgba(255,255,255,0.1);
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--border);
        }
        
        h1 {
            font-size: 1.75rem;
            background: linear-gradient(135deg, var(--accent), #a855f7);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .stat-card {
            background: var(--bg-secondary);
            border-radius: 12px;
            padding: 1.25rem;
            text-align: center;
            border: 1px solid var(--border);
        }
        
        .stat-card h3 {
            font-size: 2rem;
            color: var(--accent);
        }
        
        .stat-card p {
            color: var(--text-secondary);
            font-size: 0.875rem;
            margin-top: 0.25rem;
        }
        
        .tabs {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
        }
        
        .tab {
            padding: 0.75rem 1.5rem;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .tab:hover, .tab.active {
            background: var(--accent);
            color: white;
            border-color: var(--accent);
        }
        
        .panel { display: none; }
        .panel.active { display: block; }
        
        table {
            width: 100%;
            border-collapse: collapse;
            background: var(--bg-secondary);
            border-radius: 12px;
            overflow: hidden;
        }
        
        th, td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }
        
        th {
            background: var(--bg-tertiary);
            font-weight: 600;
            font-size: 0.875rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        tr:hover { background: rgba(99, 102, 241, 0.05); }
        
        .btn {
            padding: 0.5rem 1rem;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-size: 0.875rem;
            transition: all 0.2s;
        }
        
        .btn-primary {
            background: var(--accent);
            color: white;
        }
        
        .btn-primary:hover { background: var(--accent-hover); }
        
        .btn-danger {
            background: var(--danger);
            color: white;
        }
        
        .btn-danger:hover { background: #dc2626; }
        
        .btn-sm {
            padding: 0.35rem 0.75rem;
            font-size: 0.75rem;
        }
        
        .actions { display: flex; gap: 0.5rem; }
        
        .badge {
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        .badge-success { background: rgba(34, 197, 94, 0.2); color: var(--success); }
        .badge-warning { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
        .badge-danger { background: rgba(239, 68, 68, 0.2); color: var(--danger); }
        
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }
        
        .modal.active { display: flex; }
        
        .modal-content {
            background: var(--bg-secondary);
            border-radius: 16px;
            padding: 2rem;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
        }
        
        .modal-close {
            background: none;
            border: none;
            color: var(--text-secondary);
            font-size: 1.5rem;
            cursor: pointer;
        }
        
        .form-group {
            margin-bottom: 1rem;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            color: var(--text-secondary);
            font-size: 0.875rem;
        }
        
        .form-group input,
        .form-group textarea,
        .form-group select {
            width: 100%;
            padding: 0.75rem;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 1rem;
        }
        
        .form-group textarea { min-height: 100px; resize: vertical; }
        
        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
            outline: none;
            border-color: var(--accent);
        }
        
        .rating-stars {
            display: flex;
            gap: 0.25rem;
        }
        
        .rating-stars span {
            font-size: 1rem;
            cursor: pointer;
        }
        
        .toast {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            animation: slideIn 0.3s ease;
            z-index: 2000;
        }
        
        .toast-success { background: var(--success); }
        .toast-error { background: var(--danger); }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .truncate {
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .search-bar {
            margin-bottom: 1rem;
        }
        
        .search-bar input {
            width: 100%;
            max-width: 400px;
            padding: 0.75rem 1rem;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-primary);
        }
        
        .loading {
            text-align: center;
            padding: 3rem;
            color: var(--text-secondary);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🎓 RateIt Admin</h1>
            <button class="btn btn-primary" onclick="loadStats()">↻ Refresh</button>
        </header>
        
        <div class="stats-grid" id="stats">
            <div class="stat-card"><h3>-</h3><p>Universities</p></div>
            <div class="stat-card"><h3>-</h3><p>Reviews</p></div>
            <div class="stat-card"><h3>-</h3><p>Countries</p></div>
            <div class="stat-card"><h3>-</h3><p>Avg Rating</p></div>
        </div>
        
        <div class="tabs">
            <button class="tab active" onclick="switchTab('universities')">Universities</button>
            <button class="tab" onclick="switchTab('reviews')">Reviews</button>
        </div>
        
        <div id="universities-panel" class="panel active">
            <div class="search-bar">
                <input type="text" placeholder="Search universities..." onkeyup="filterTable(this, 'universities-table')">
            </div>
            <div id="universities-content"><div class="loading">Loading...</div></div>
        </div>
        
        <div id="reviews-panel" class="panel">
            <div class="search-bar">
                <input type="text" placeholder="Search reviews..." onkeyup="filterTable(this, 'reviews-table')">
            </div>
            <div id="reviews-content"><div class="loading">Loading...</div></div>
        </div>
    </div>
    
    <!-- Edit University Modal -->
    <div class="modal" id="uni-modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="uni-modal-title">Edit University</h2>
                <button class="modal-close" onclick="closeModal('uni-modal')">&times;</button>
            </div>
            <form id="uni-form" onsubmit="saveUniversity(event)">
                <input type="hidden" id="uni-id">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="uni-name" required>
                </div>
                <div class="form-group">
                    <label>Normalized Name</label>
                    <input type="text" id="uni-normalized">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="uni-description"></textarea>
                </div>
                <div class="form-group">
                    <label>Niche Details</label>
                    <textarea id="uni-niche"></textarea>
                </div>
                <div class="form-group">
                    <label>Location</label>
                    <input type="text" id="uni-location">
                </div>
                <div class="form-group">
                    <label>Country</label>
                    <input type="text" id="uni-country">
                </div>
                <div class="form-group">
                    <label>Image URL</label>
                    <input type="url" id="uni-image">
                </div>
                <div class="form-group">
                    <label>Website URL</label>
                    <input type="url" id="uni-website">
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="uni-verified"> Verified</label>
                </div>
                <button type="submit" class="btn btn-primary">Save Changes</button>
            </form>
        </div>
    </div>
    
    <!-- Edit Review Modal -->
    <div class="modal" id="review-modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Review</h2>
                <button class="modal-close" onclick="closeModal('review-modal')">&times;</button>
            </div>
            <form id="review-form" onsubmit="saveReview(event)">
                <input type="hidden" id="review-id">
                <div class="form-group">
                    <label>Category</label>
                    <select id="review-category">
                        <option>Academics</option>
                        <option>Dorms & Housing</option>
                        <option>Food & Dining</option>
                        <option>Social Life</option>
                        <option>Administration</option>
                        <option>Cost of Living</option>
                        <option>Safety</option>
                        <option>Career Support</option>
                        <option>Transportation</option>
                        <option>Facilities</option>
                        <option>Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Rating (1-5)</label>
                    <input type="number" id="review-rating" min="1" max="5" required>
                </div>
                <div class="form-group">
                    <label>Comment</label>
                    <textarea id="review-comment" required></textarea>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="review-status">
                        <option value="approved">Approved</option>
                        <option value="pending">Pending</option>
                        <option value="rejected">Rejected</option>
                        <option value="flagged">Flagged</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Moderation Reason</label>
                    <input type="text" id="review-reason">
                </div>
                <button type="submit" class="btn btn-primary">Save Changes</button>
            </form>
        </div>
    </div>

    <script>
        const API = '';
        
        // Load initial data
        loadStats();
        loadUniversities();
        loadReviews();
        
        async function loadStats() {
            try {
                const res = await fetch(API + '/api/admin/stats');
                const data = await res.json();
                document.getElementById('stats').innerHTML = \`
                    <div class="stat-card"><h3>\${data.total_universities}</h3><p>Universities</p></div>
                    <div class="stat-card"><h3>\${data.total_reviews}</h3><p>Total Reviews</p></div>
                    <div class="stat-card"><h3>\${data.total_countries}</h3><p>Countries</p></div>
                    <div class="stat-card"><h3>\${Number(data.overall_avg_rating || 0).toFixed(1)}</h3><p>Avg Rating</p></div>
                \`;
            } catch (e) { console.error(e); }
        }
        
        async function loadUniversities() {
            try {
                const res = await fetch(API + '/api/admin/universities');
                const data = await res.json();
                
                document.getElementById('universities-content').innerHTML = \`
                    <table id="universities-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Location</th>
                                <th>Country</th>
                                <th>Reviews</th>
                                <th>Rating</th>
                                <th>Verified</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            \${data.map(u => \`
                                <tr>
                                    <td class="truncate" title="\${u.name}">\${u.name}</td>
                                    <td>\${u.location || '-'}</td>
                                    <td>\${u.country || '-'}</td>
                                    <td>\${u.review_count}</td>
                                    <td>\${Number(u.avg_rating).toFixed(1)}</td>
                                    <td>\${u.is_verified ? '✓' : '-'}</td>
                                    <td class="actions">
                                        <button class="btn btn-primary btn-sm" onclick='editUniversity(\${JSON.stringify(u)})'>Edit</button>
                                        <button class="btn btn-danger btn-sm" onclick="deleteUniversity('\${u.id}')">Delete</button>
                                    </td>
                                </tr>
                            \`).join('')}
                        </tbody>
                    </table>
                \`;
            } catch (e) { 
                document.getElementById('universities-content').innerHTML = '<p style="color:red">Error loading universities</p>';
            }
        }
        
        async function loadReviews() {
            try {
                const res = await fetch(API + '/api/admin/reviews');
                const data = await res.json();
                
                document.getElementById('reviews-content').innerHTML = \`
                    <table id="reviews-table">
                        <thead>
                            <tr>
                                <th>University</th>
                                <th>Category</th>
                                <th>Rating</th>
                                <th>Comment</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            \${data.map(r => \`
                                <tr>
                                    <td class="truncate" title="\${r.university_name}">\${r.university_name}</td>
                                    <td>\${r.category}</td>
                                    <td>\${'★'.repeat(r.rating)}\${'☆'.repeat(5-r.rating)}</td>
                                    <td class="truncate" title="\${r.comment}">\${r.comment}</td>
                                    <td><span class="badge badge-\${r.moderation_status === 'approved' ? 'success' : r.moderation_status === 'pending' ? 'warning' : 'danger'}">\${r.moderation_status}</span></td>
                                    <td>\${new Date(r.created_at).toLocaleDateString()}</td>
                                    <td class="actions">
                                        <button class="btn btn-primary btn-sm" onclick='editReview(\${JSON.stringify(r)})'>Edit</button>
                                        <button class="btn btn-danger btn-sm" onclick="deleteReview('\${r.id}')">Delete</button>
                                    </td>
                                </tr>
                            \`).join('')}
                        </tbody>
                    </table>
                \`;
            } catch (e) {
                document.getElementById('reviews-content').innerHTML = '<p style="color:red">Error loading reviews</p>';
            }
        }
        
        function switchTab(tab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            document.querySelector(\`[onclick="switchTab('\${tab}')"]\`).classList.add('active');
            document.getElementById(tab + '-panel').classList.add('active');
        }
        
        function editUniversity(u) {
            document.getElementById('uni-id').value = u.id;
            document.getElementById('uni-name').value = u.name || '';
            document.getElementById('uni-normalized').value = u.normalized_name || '';
            document.getElementById('uni-description').value = u.description || '';
            document.getElementById('uni-niche').value = u.niche_details || '';
            document.getElementById('uni-location').value = u.location || '';
            document.getElementById('uni-country').value = u.country || '';
            document.getElementById('uni-image').value = u.image_url || '';
            document.getElementById('uni-website').value = u.website_url || '';
            document.getElementById('uni-verified').checked = u.is_verified;
            document.getElementById('uni-modal').classList.add('active');
        }
        
        function editReview(r) {
            document.getElementById('review-id').value = r.id;
            document.getElementById('review-category').value = r.category;
            document.getElementById('review-rating').value = r.rating;
            document.getElementById('review-comment').value = r.comment;
            document.getElementById('review-status').value = r.moderation_status;
            document.getElementById('review-reason').value = r.moderation_reason || '';
            document.getElementById('review-modal').classList.add('active');
        }
        
        async function saveUniversity(e) {
            e.preventDefault();
            const id = document.getElementById('uni-id').value;
            const data = {
                name: document.getElementById('uni-name').value,
                normalized_name: document.getElementById('uni-normalized').value,
                description: document.getElementById('uni-description').value,
                niche_details: document.getElementById('uni-niche').value,
                location: document.getElementById('uni-location').value,
                country: document.getElementById('uni-country').value,
                image_url: document.getElementById('uni-image').value,
                website_url: document.getElementById('uni-website').value,
                is_verified: document.getElementById('uni-verified').checked
            };
            
            try {
                await fetch(API + '/api/admin/universities/' + id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                closeModal('uni-modal');
                loadUniversities();
                showToast('University updated!', 'success');
            } catch (e) {
                showToast('Error saving university', 'error');
            }
        }
        
        async function saveReview(e) {
            e.preventDefault();
            const id = document.getElementById('review-id').value;
            const data = {
                category: document.getElementById('review-category').value,
                rating: parseInt(document.getElementById('review-rating').value),
                comment: document.getElementById('review-comment').value,
                moderation_status: document.getElementById('review-status').value,
                moderation_reason: document.getElementById('review-reason').value
            };
            
            try {
                await fetch(API + '/api/admin/reviews/' + id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                closeModal('review-modal');
                loadReviews();
                showToast('Review updated!', 'success');
            } catch (e) {
                showToast('Error saving review', 'error');
            }
        }
        
        async function deleteUniversity(id) {
            if (!confirm('Delete this university and ALL its reviews?')) return;
            try {
                await fetch(API + '/api/admin/universities/' + id, { method: 'DELETE' });
                loadUniversities();
                loadStats();
                showToast('University deleted', 'success');
            } catch (e) {
                showToast('Error deleting university', 'error');
            }
        }
        
        async function deleteReview(id) {
            if (!confirm('Delete this review?')) return;
            try {
                await fetch(API + '/api/admin/reviews/' + id, { method: 'DELETE' });
                loadReviews();
                loadStats();
                showToast('Review deleted', 'success');
            } catch (e) {
                showToast('Error deleting review', 'error');
            }
        }
        
        function closeModal(id) {
            document.getElementById(id).classList.remove('active');
        }
        
        function filterTable(input, tableId) {
            const filter = input.value.toLowerCase();
            const rows = document.querySelectorAll('#' + tableId + ' tbody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(filter) ? '' : 'none';
            });
        }
        
        function showToast(message, type) {
            const toast = document.createElement('div');
            toast.className = 'toast toast-' + type;
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
        
        // Close modal on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        });
    </script>
</body>
</html>`;

export default app;
