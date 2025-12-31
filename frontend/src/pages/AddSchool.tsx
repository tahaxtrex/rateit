import React, { useState, useEffect } from 'react';
import { createUniversity, submitReview, fetchCategories } from '../services/api';
import StarRating from '../components/StarRating';

interface AddSchoolProps {
    onNavigate: (route: 'home' | 'ask' | 'reviews' | 'add-school' | 'university', universityId?: string) => void;
}

const AddSchool: React.FC<AddSchoolProps> = ({ onNavigate }) => {
    const [categories, setCategories] = useState<string[]>([]);

    // University form
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [country, setCountry] = useState('');
    const [description, setDescription] = useState('');

    // Initial review (optional)
    const [includeReview, setIncludeReview] = useState(true);
    const [reviewCategory, setReviewCategory] = useState('');
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewComment, setReviewComment] = useState('');

    // Niche details
    const [nicheDetails, setNicheDetails] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        fetchCategories()
            .then(cats => {
                setCategories(cats);
                if (cats.length > 0) setReviewCategory(cats[0]);
            })
            .catch(console.error);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!name.trim() || !location.trim() || !country.trim()) {
            setError('Name, location, and country are required');
            return;
        }

        if (includeReview && reviewRating === 0) {
            setError('Please select a rating for your review');
            return;
        }

        if (includeReview && reviewComment.length < 10) {
            setError('Review comment must be at least 10 characters');
            return;
        }

        setSubmitting(true);
        try {
            // Create university
            const fullDescription = nicheDetails
                ? `${description}\n\nNiche Details: ${nicheDetails}`
                : description;

            const newUni = await createUniversity({
                name: name.trim(),
                location: location.trim(),
                country: country.trim(),
                description: fullDescription.trim(),
            });

            // Submit initial review if included
            if (includeReview && reviewComment.trim()) {
                await submitReview({
                    universityId: newUni.id,
                    category: reviewCategory,
                    rating: reviewRating,
                    comment: reviewComment.trim(),
                });
            }

            setSuccess(true);

            // Navigate to new university after 2 seconds
            setTimeout(() => {
                onNavigate('university', newUni.id);
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to add university');
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div style={{
                minHeight: 'calc(100vh - 72px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div className="glass-card" style={{
                    padding: '60px',
                    textAlign: 'center',
                    maxWidth: '500px',
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: 'rgba(0, 217, 160, 0.2)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px',
                        fontSize: '2.5rem',
                    }}>
                        ✓
                    </div>
                    <h2 className="heading-md" style={{ marginBottom: '12px' }}>
                        University Added!
                    </h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Thank you for contributing. Redirecting to your new university page...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: 'calc(100vh - 72px)' }}>
            {/* Header */}
            <section style={{ padding: '40px 0 20px', textAlign: 'center' }}>
                <div className="container">
                    <h1 className="heading-lg" style={{ marginBottom: '12px' }}>
                        Add <span className="text-gradient">Your School</span>
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
                        Help other students by adding your university and sharing the details they need to know.
                    </p>
                </div>
            </section>

            {/* Form */}
            <section className="container" style={{ paddingBottom: '60px' }}>
                <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                    <form onSubmit={handleSubmit}>
                        {/* University Details */}
                        <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                            <h3 style={{ fontWeight: 600, marginBottom: '20px' }}>
                                📍 University Details
                            </h3>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.85rem',
                                    marginBottom: '8px',
                                    color: 'var(--text-secondary)',
                                }}>
                                    University Name *
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., University of Lagos"
                                    className="glass-input"
                                    required
                                />
                            </div>

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
                                        City/Location *
                                    </label>
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        placeholder="e.g., Lagos"
                                        className="glass-input"
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '0.85rem',
                                        marginBottom: '8px',
                                        color: 'var(--text-secondary)',
                                    }}>
                                        Country *
                                    </label>
                                    <input
                                        type="text"
                                        value={country}
                                        onChange={(e) => setCountry(e.target.value)}
                                        placeholder="e.g., Nigeria"
                                        className="glass-input"
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.85rem',
                                    marginBottom: '8px',
                                    color: 'var(--text-secondary)',
                                }}>
                                    Description
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Brief description of the university..."
                                    className="glass-textarea"
                                    rows={3}
                                />
                            </div>

                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.85rem',
                                    marginBottom: '8px',
                                    color: 'var(--text-secondary)',
                                }}>
                                    🔮 Niche Details (Optional)
                                    <span style={{
                                        display: 'block',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)',
                                        marginTop: '4px',
                                        fontWeight: 400,
                                    }}>
                                        Share the weird, unique, or insider info that only students know!
                                    </span>
                                </label>
                                <textarea
                                    value={nicheDetails}
                                    onChange={(e) => setNicheDetails(e.target.value)}
                                    placeholder="e.g., The wifi only works well in the library. The 3rd floor bathroom has the best mirrors. There's a secret study room behind the cafeteria..."
                                    className="glass-textarea"
                                    rows={3}
                                />
                            </div>
                        </div>

                        {/* Initial Review */}
                        <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '20px',
                            }}>
                                <h3 style={{ fontWeight: 600 }}>
                                    ✍️ Add Your First Review
                                </h3>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={includeReview}
                                        onChange={(e) => setIncludeReview(e.target.checked)}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    <span style={{ fontSize: '0.85rem' }}>Include review</span>
                                </label>
                            </div>

                            {includeReview && (
                                <>
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
                                                value={reviewCategory}
                                                onChange={(e) => setReviewCategory(e.target.value)}
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
                                                    rating={reviewRating}
                                                    size="lg"
                                                    interactive
                                                    onRatingChange={setReviewRating}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{
                                            display: 'block',
                                            fontSize: '0.85rem',
                                            marginBottom: '8px',
                                            color: 'var(--text-secondary)',
                                        }}>
                                            Your Review (Anonymous)
                                        </label>
                                        <textarea
                                            value={reviewComment}
                                            onChange={(e) => setReviewComment(e.target.value)}
                                            placeholder="Share your honest experience..."
                                            className="glass-textarea"
                                            rows={4}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{
                                background: 'rgba(255, 107, 107, 0.1)',
                                border: '1px solid rgba(255, 107, 107, 0.3)',
                                borderRadius: 'var(--radius-md)',
                                padding: '16px',
                                marginBottom: '24px',
                                color: '#ff6b6b',
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="btn-primary"
                            style={{ width: '100%', padding: '16px' }}
                        >
                            {submitting ? 'Adding University...' : '🚀 Add University'}
                        </button>
                    </form>
                </div>
            </section>
        </div>
    );
};

export default AddSchool;
