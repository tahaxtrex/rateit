import React, { useEffect, useState } from 'react';
import { University, Review, Category } from '../types';
import { fetchUniversities, fetchReviews, submitReview, fetchCategories } from '../services/api';
import StarRating from '../components/StarRating';

interface ReviewsProps {
    onNavigate: (route: 'home' | 'ask' | 'reviews' | 'add-school' | 'university', universityId?: string) => void;
}

const Reviews: React.FC<ReviewsProps> = ({ onNavigate }) => {
    const [universities, setUniversities] = useState<University[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedUniId, setSelectedUniId] = useState('');
    const [loading, setLoading] = useState(true);

    // Review form state
    const [showForm, setShowForm] = useState(false);
    const [formCategory, setFormCategory] = useState('');
    const [formRating, setFormRating] = useState(0);
    const [formComment, setFormComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [submitSuccess, setSubmitSuccess] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [unisData, catsData] = await Promise.all([
                    fetchUniversities(),
                    fetchCategories(),
                ]);
                setUniversities(unisData);
                setCategories(catsData);
                if (catsData.length > 0) {
                    setFormCategory(catsData[0]);
                }
            } catch (err) {
                console.error('Failed to load data:', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        if (selectedUniId) {
            setLoading(true);
            fetchReviews(selectedUniId)
                .then(setReviews)
                .catch(console.error)
                .finally(() => setLoading(false));
        } else {
            setReviews([]);
        }
    }, [selectedUniId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError('');
        setSubmitSuccess(false);

        if (!selectedUniId) {
            setSubmitError('Please select a university');
            return;
        }
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
                universityId: selectedUniId,
                category: formCategory,
                rating: formRating,
                comment: formComment,
            });

            // Refresh reviews
            const updatedReviews = await fetchReviews(selectedUniId);
            setReviews(updatedReviews);

            // Reset form
            setFormRating(0);
            setFormComment('');
            setSubmitSuccess(true);
            setShowForm(false);

            setTimeout(() => setSubmitSuccess(false), 3000);
        } catch (err: any) {
            setSubmitError(err.message || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    const selectedUni = universities.find(u => u.id === selectedUniId);

    return (
        <div style={{ minHeight: 'calc(100vh - 72px)' }}>
            {/* Header */}
            <section style={{ padding: '40px 0 20px', textAlign: 'center' }}>
                <div className="container">
                    <h1 className="heading-lg" style={{ marginBottom: '12px' }}>
                        Student <span className="text-gradient">Reviews</span>
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
                        Read honest experiences from students and share your own to help others.
                    </p>
                </div>
            </section>

            {/* Main Content */}
            <section className="container" style={{ paddingBottom: '60px' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                    {/* University Selector */}
                    <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                        <label style={{
                            display: 'block',
                            fontWeight: 600,
                            marginBottom: '12px',
                            fontSize: '0.9rem',
                        }}>
                            Select a University
                        </label>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <select
                                value={selectedUniId}
                                onChange={(e) => setSelectedUniId(e.target.value)}
                                className="glass-select"
                                style={{ flex: 1, minWidth: '250px' }}
                            >
                                <option value="">Choose a university...</option>
                                {universities.map(uni => (
                                    <option key={uni.id} value={uni.id}>
                                        {uni.name} - {uni.country}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => onNavigate('add-school')}
                                className="glass-btn"
                            >
                                + Add School
                            </button>
                        </div>
                    </div>

                    {/* Success Message */}
                    {submitSuccess && (
                        <div style={{
                            background: 'rgba(0, 217, 160, 0.1)',
                            border: '1px solid rgba(0, 217, 160, 0.3)',
                            borderRadius: 'var(--radius-md)',
                            padding: '16px',
                            marginBottom: '24px',
                            color: '#00d9a0',
                            textAlign: 'center',
                        }}>
                            ✓ Review submitted successfully!
                        </div>
                    )}

                    {/* Write Review Button / Form */}
                    {selectedUniId && !showForm && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="btn-primary"
                            style={{ width: '100%', marginBottom: '24px', padding: '16px' }}
                        >
                            ✍️ Write a Review for {selectedUni?.name}
                        </button>
                    )}

                    {showForm && (
                        <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                            <h3 style={{ fontWeight: 600, marginBottom: '20px' }}>
                                Share Your Experience at {selectedUni?.name}
                            </h3>
                            <form onSubmit={handleSubmit}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
                                        Your Review (Anonymous)
                                    </label>
                                    <textarea
                                        value={formComment}
                                        onChange={(e) => setFormComment(e.target.value)}
                                        placeholder="Share details about your experience. Be honest but respectful..."
                                        className="glass-textarea"
                                        rows={4}
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
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="btn-primary"
                                    >
                                        {submitting ? 'Submitting...' : 'Submit Review'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Reviews List */}
                    {selectedUniId && (
                        <div>
                            <h3 style={{
                                fontWeight: 600,
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}>
                                <span>Reviews ({reviews.length})</span>
                                {selectedUni && (
                                    <button
                                        onClick={() => onNavigate('university', selectedUniId)}
                                        className="glass-btn"
                                        style={{ fontSize: '0.8rem' }}
                                    >
                                        View Full Profile →
                                    </button>
                                )}
                            </h3>

                            {loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                    <div className="spinner" />
                                </div>
                            ) : reviews.length === 0 ? (
                                <div className="glass-card" style={{
                                    padding: '40px',
                                    textAlign: 'center',
                                    color: 'var(--text-muted)',
                                }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📝</div>
                                    <p>No reviews yet. Be the first to share your experience!</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {reviews.slice().reverse().map(review => (
                                        <div key={review.id} className="glass-card" style={{ padding: '20px' }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginBottom: '12px',
                                            }}>
                                                <span style={{
                                                    background: 'var(--glass-bg)',
                                                    padding: '4px 12px',
                                                    borderRadius: 'var(--radius-full)',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    color: 'var(--accent-secondary)',
                                                }}>
                                                    {review.category}
                                                </span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {new Date(review.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div style={{ marginBottom: '8px' }}>
                                                <StarRating rating={review.rating} size="sm" />
                                            </div>
                                            <p style={{
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
                    )}

                    {/* Empty State */}
                    {!selectedUniId && (
                        <div className="glass-card" style={{
                            padding: '60px 40px',
                            textAlign: 'center',
                        }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎓</div>
                            <h3 style={{ marginBottom: '8px' }}>Select a University</h3>
                            <p style={{ color: 'var(--text-muted)' }}>
                                Choose a university above to view reviews or add your own
                            </p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default Reviews;
