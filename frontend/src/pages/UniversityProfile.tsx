import React, { useEffect, useState } from 'react';
import { University, Review, AggregatedStats } from '../types';
import { fetchUniversity, fetchReviews, submitReview, fetchCategories } from '../services/api';
import StarRating from '../components/StarRating';
import AIChat from '../components/AIChat';

interface UniversityProfileProps {
    universityId: string;
    onNavigate: (route: 'home' | 'ask' | 'reviews' | 'add-school' | 'university', universityId?: string) => void;
}

const UniversityProfile: React.FC<UniversityProfileProps> = ({ universityId, onNavigate }) => {
    const [university, setUniversity] = useState<University | null>(null);
    const [stats, setStats] = useState<AggregatedStats | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Review form
    const [showForm, setShowForm] = useState(false);
    const [formCategory, setFormCategory] = useState('');
    const [formRating, setFormRating] = useState(0);
    const [formComment, setFormComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [uniData, reviewsData, catsData] = await Promise.all([
                    fetchUniversity(universityId),
                    fetchReviews(universityId),
                    fetchCategories(),
                ]);
                setUniversity(uniData.university);
                setStats(uniData.stats);
                setReviews(reviewsData);
                setCategories(catsData);
                if (catsData.length > 0) setFormCategory(catsData[0]);
            } catch (err) {
                console.error('Failed to load data:', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [universityId]);

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError('');

        if (formRating === 0) {
            setSubmitError('Please select a rating');
            return;
        }
        if (formComment.length < 10) {
            setSubmitError('Comment must be at least 10 characters');
            return;
        }

        setSubmitting(true);
        try {
            await submitReview({
                universityId,
                category: formCategory,
                rating: formRating,
                comment: formComment,
            });

            // Refresh data
            const [uniData, reviewsData] = await Promise.all([
                fetchUniversity(universityId),
                fetchReviews(universityId),
            ]);
            setStats(uniData.stats);
            setReviews(reviewsData);

            // Reset form
            setShowForm(false);
            setFormRating(0);
            setFormComment('');
        } catch (err: any) {
            setSubmitError(err.message || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{
                minHeight: 'calc(100vh - 72px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!university || !stats) {
        return (
            <div style={{
                minHeight: 'calc(100vh - 72px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>😕</div>
                    <h2>University not found</h2>
                    <button onClick={() => onNavigate('home')} className="btn-primary" style={{ marginTop: '20px' }}>
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: '60px' }}>
            {/* University Header */}
            <section className="glass-card" style={{
                margin: 0,
                borderRadius: 0,
                border: 'none',
                borderBottom: '1px solid var(--glass-border)',
            }}>
                <div className="container" style={{ padding: '32px 24px' }}>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '24px',
                    }}>
                        <div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.85rem',
                                color: 'var(--text-muted)',
                                marginBottom: '8px',
                            }}>
                                <button
                                    onClick={() => onNavigate('home')}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--accent-secondary)',
                                        cursor: 'pointer',
                                        padding: 0,
                                    }}
                                >
                                    Home
                                </button>
                                <span>/</span>
                                <span>{university.country}</span>
                                <span>•</span>
                                <span>{university.location}</span>
                            </div>
                            <h1 className="heading-lg" style={{ marginBottom: '12px' }}>
                                {university.name}
                            </h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <StarRating rating={stats.averageRating} size="lg" />
                                <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                                    {stats.averageRating.toFixed(1)}
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    ({stats.totalReviews} reviews)
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowForm(!showForm)}
                            className="btn-primary"
                        >
                            ✍️ Write a Review
                        </button>
                    </div>
                </div>
            </section>

            <div className="container" style={{ paddingTop: '32px' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr',
                    gap: '32px',
                }}>
                    {/* Main Content */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '24px',
                    }}>
                        {/* Left Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Review Form */}
                            {showForm && (
                                <div className="glass-card" style={{ padding: '24px' }}>
                                    <h3 style={{ fontWeight: 600, marginBottom: '16px' }}>
                                        Share Your Experience
                                    </h3>
                                    <form onSubmit={handleSubmitReview}>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '16px',
                                            marginBottom: '16px',
                                        }}>
                                            <div>
                                                <label style={{
                                                    display: 'block',
                                                    fontSize: '0.85rem',
                                                    marginBottom: '8px',
                                                    color: 'var(--text-secondary)',
                                                }}>
                                                    Category
                                                </label>
                                                <select
                                                    value={formCategory}
                                                    onChange={(e) => setFormCategory(e.target.value)}
                                                    className="glass-select"
                                                >
                                                    {categories.map(cat => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{
                                                    display: 'block',
                                                    fontSize: '0.85rem',
                                                    marginBottom: '8px',
                                                    color: 'var(--text-secondary)',
                                                }}>
                                                    Rating
                                                </label>
                                                <div style={{ paddingTop: '8px' }}>
                                                    <StarRating
                                                        rating={formRating}
                                                        size="lg"
                                                        interactive
                                                        onRatingChange={setFormRating}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{
                                                display: 'block',
                                                fontSize: '0.85rem',
                                                marginBottom: '8px',
                                                color: 'var(--text-secondary)',
                                            }}>
                                                Review (Anonymous)
                                            </label>
                                            <textarea
                                                value={formComment}
                                                onChange={(e) => setFormComment(e.target.value)}
                                                placeholder="Share your honest experience..."
                                                className="glass-textarea"
                                                rows={3}
                                            />
                                        </div>

                                        {submitError && (
                                            <div style={{
                                                background: 'rgba(255, 107, 107, 0.1)',
                                                border: '1px solid rgba(255, 107, 107, 0.3)',
                                                borderRadius: 'var(--radius-sm)',
                                                padding: '12px',
                                                marginBottom: '16px',
                                                color: '#ff6b6b',
                                                fontSize: '0.9rem',
                                            }}>
                                                {submitError}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                            <button
                                                type="button"
                                                onClick={() => setShowForm(false)}
                                                className="glass-btn"
                                            >
                                                Cancel
                                            </button>
                                            <button type="submit" disabled={submitting} className="btn-primary">
                                                {submitting ? 'Submitting...' : 'Submit'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Category Breakdown */}
                            <div className="glass-card" style={{ padding: '24px' }}>
                                <h3 style={{ fontWeight: 600, marginBottom: '16px' }}>
                                    Rating Breakdown
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {Object.entries(stats.categoryBreakdown)
                                        .filter(([_, data]) => data.count > 0)
                                        .map(([cat, data]) => (
                                            <div key={cat} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                            }}>
                                                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                    {cat}
                                                </span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '100px',
                                                        height: '6px',
                                                        background: 'var(--glass-bg)',
                                                        borderRadius: '3px',
                                                        overflow: 'hidden',
                                                    }}>
                                                        <div style={{
                                                            width: `${(data.average / 5) * 100}%`,
                                                            height: '100%',
                                                            background: 'var(--accent-gradient)',
                                                            borderRadius: '3px',
                                                        }} />
                                                    </div>
                                                    <span style={{ fontWeight: 600, minWidth: '24px' }}>
                                                        {data.average || '-'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            {/* Reviews */}
                            <div>
                                <h3 style={{ fontWeight: 600, marginBottom: '16px' }}>
                                    Recent Reviews ({reviews.length})
                                </h3>
                                {reviews.length === 0 ? (
                                    <div className="glass-card" style={{
                                        padding: '40px',
                                        textAlign: 'center',
                                        color: 'var(--text-muted)',
                                    }}>
                                        <p>No reviews yet. Be the first!</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {reviews.slice().reverse().map(review => (
                                            <div key={review.id} className="glass-card" style={{ padding: '20px' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    marginBottom: '8px',
                                                }}>
                                                    <span style={{
                                                        background: 'var(--glass-bg)',
                                                        padding: '4px 10px',
                                                        borderRadius: 'var(--radius-full)',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        textTransform: 'uppercase',
                                                        color: 'var(--accent-secondary)',
                                                    }}>
                                                        {review.category}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        {new Date(review.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <StarRating rating={review.rating} size="sm" />
                                                <p style={{
                                                    marginTop: '12px',
                                                    fontSize: '0.9rem',
                                                    color: 'var(--text-secondary)',
                                                    lineHeight: 1.6,
                                                }}>
                                                    {review.comment}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column - AI Chat */}
                        <div>
                            <div style={{ position: 'sticky', top: '96px' }}>
                                <AIChat
                                    universities={[university]}
                                    selectedUniversityId={universityId}
                                />
                                <div className="glass-card" style={{
                                    marginTop: '16px',
                                    padding: '16px',
                                }}>
                                    <h4 style={{
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        color: 'var(--accent-secondary)',
                                        marginBottom: '12px',
                                    }}>
                                        💡 Why ask the AI?
                                    </h4>
                                    <ul style={{
                                        fontSize: '0.8rem',
                                        color: 'var(--text-secondary)',
                                        listStyle: 'disc',
                                        paddingLeft: '20px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                    }}>
                                        <li>Summarizes all reviews instantly</li>
                                        <li>Identifies common praises & complaints</li>
                                        <li>Maintains neutrality on topics</li>
                                        <li>Saves you reading time</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UniversityProfile;
