import React, { useState, useEffect } from 'react';
import { fetchRankings } from '../services/api';

interface CategoryRatings {
    academics: number;
    dorms: number;
    food: number;
    social: number;
    admin: number;
    cost: number;
    safety: number;
    career: number;
}

interface University {
    id: string;
    name: string;
    imageUrl: string;
    location: string;
    reviewCount: number;
    avgRating: number;
    categories: CategoryRatings;
}

interface CountryRanking {
    country: string;
    universities: University[];
}

interface DashboardProps {
    onNavigate: (route: 'home' | 'ask' | 'reviews' | 'add-school' | 'university' | 'dashboard' | 'compare', universityId?: string) => void;
}

const categoryLabels: { [key: string]: { label: string; emoji: string } } = {
    academics: { label: 'Academics', emoji: '📚' },
    dorms: { label: 'Dorms', emoji: '🏠' },
    food: { label: 'Food', emoji: '🍕' },
    social: { label: 'Social', emoji: '🎉' },
    admin: { label: 'Admin', emoji: '📋' },
    cost: { label: 'Cost', emoji: '💰' },
    safety: { label: 'Safety', emoji: '🛡️' },
    career: { label: 'Career', emoji: '💼' },
};

const RatingBar: React.FC<{ rating: number; label: string; emoji: string }> = ({ rating, label, emoji }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
        <span style={{ width: '24px' }}>{emoji}</span>
        <span style={{ width: '60px', color: 'var(--text-secondary)' }}>{label}</span>
        <div style={{
            flex: 1,
            height: '8px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
        }}>
            <div style={{
                width: `${(rating / 5) * 100}%`,
                height: '100%',
                background: rating >= 4 ? 'linear-gradient(90deg, #00d9a0, #00b894)' :
                    rating >= 3 ? 'linear-gradient(90deg, #fdcb6e, #f39c12)' :
                        'linear-gradient(90deg, #ff6b6b, #ee5a52)',
                borderRadius: '4px',
                transition: 'width 0.3s ease',
            }} />
        </div>
        <span style={{ width: '32px', textAlign: 'right', fontWeight: 600 }}>
            {rating > 0 ? rating.toFixed(1) : '-'}
        </span>
    </div>
);

const UniversityCard: React.FC<{ uni: University; rank: number; onNavigate: DashboardProps['onNavigate'] }> = ({ uni, rank, onNavigate }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div
            className="glass-card"
            style={{
                padding: '20px',
                marginBottom: '12px',
                cursor: 'pointer',
                transition: 'transform 0.2s ease',
            }}
            onClick={() => setExpanded(!expanded)}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Rank Badge */}
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: rank === 1 ? 'linear-gradient(135deg, #ffd700, #ffb700)' :
                        rank === 2 ? 'linear-gradient(135deg, #c0c0c0, #a0a0a0)' :
                            rank === 3 ? 'linear-gradient(135deg, #cd7f32, #b87333)' :
                                'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: rank <= 3 ? '1.1rem' : '0.9rem',
                    color: rank <= 3 ? '#000' : 'var(--text-secondary)',
                    flexShrink: 0,
                }}>
                    #{rank}
                </div>

                {/* University Info */}
                <div style={{ flex: 1 }}>
                    <h4 style={{ fontWeight: 600, marginBottom: '4px' }}>{uni.name}</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        📍 {uni.location} • {uni.reviewCount} reviews
                    </p>
                </div>

                {/* Rating */}
                <div style={{ textAlign: 'right' }}>
                    <div style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: uni.avgRating >= 4 ? '#00d9a0' :
                            uni.avgRating >= 3 ? '#fdcb6e' : '#ff6b6b',
                    }}>
                        {uni.avgRating > 0 ? uni.avgRating.toFixed(1) : '0.0'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 5.0</div>
                </div>

                {/* Expand Arrow */}
                <div style={{
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    fontSize: '1.2rem',
                }}>
                    ▼
                </div>
            </div>

            {/* Expanded Category Breakdown */}
            {expanded && (
                <div style={{
                    marginTop: '20px',
                    paddingTop: '20px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '8px',
                    }}>
                        {Object.entries(categoryLabels).map(([key, { label, emoji }]) => (
                            <RatingBar
                                key={key}
                                rating={uni.categories[key as keyof CategoryRatings]}
                                label={label}
                                emoji={emoji}
                            />
                        ))}
                    </div>
                    <button
                        className="btn-primary"
                        style={{ marginTop: '16px', padding: '10px 20px', fontSize: '0.85rem' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('university', uni.id);
                        }}
                    >
                        View University →
                    </button>
                </div>
            )}
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
    const [rankings, setRankings] = useState<CountryRanking[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchRankings()
            .then((data) => {
                setRankings(data);
                // Expand first country by default
                if (data.length > 0) {
                    setExpandedCountries(new Set([data[0].country]));
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const toggleCountry = (country: string) => {
        setExpandedCountries(prev => {
            const next = new Set(prev);
            if (next.has(country)) {
                next.delete(country);
            } else {
                next.add(country);
            }
            return next;
        });
    };

    if (loading) {
        return (
            <div style={{
                minHeight: 'calc(100vh - 72px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
                    <p>Loading rankings...</p>
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
                        🏆 <span className="text-gradient">University Rankings</span>
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                        See how universities rank in each country based on real student reviews.
                        Click any school to see category breakdowns.
                    </p>
                </div>
            </section>

            {/* Rankings by Country */}
            <section className="container" style={{ paddingBottom: '60px' }}>
                {rankings.length === 0 ? (
                    <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
                        <p style={{ fontSize: '1.2rem', marginBottom: '16px' }}>No universities found</p>
                        <button className="btn-primary" onClick={() => onNavigate('add-school')}>
                            Add the first university →
                        </button>
                    </div>
                ) : (
                    rankings.map((countryData) => (
                        <div key={countryData.country} style={{ marginBottom: '24px' }}>
                            {/* Country Header */}
                            <div
                                className="glass-card"
                                style={{
                                    padding: '20px 24px',
                                    marginBottom: '12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                }}
                                onClick={() => toggleCountry(countryData.country)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '1.5rem' }}>🌍</span>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                                        {countryData.country}
                                    </h2>
                                    <span style={{
                                        background: 'rgba(108, 92, 231, 0.2)',
                                        padding: '4px 12px',
                                        borderRadius: '999px',
                                        fontSize: '0.85rem',
                                        color: '#a29bfe',
                                    }}>
                                        {countryData.universities.length} {countryData.universities.length === 1 ? 'school' : 'schools'}
                                    </span>
                                </div>
                                <span style={{
                                    transform: expandedCountries.has(countryData.country) ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease',
                                    fontSize: '1.2rem',
                                }}>
                                    ▼
                                </span>
                            </div>

                            {/* Universities List */}
                            {expandedCountries.has(countryData.country) && (
                                <div style={{ paddingLeft: '12px' }}>
                                    {countryData.universities.map((uni, index) => (
                                        <UniversityCard
                                            key={uni.id}
                                            uni={uni}
                                            rank={index + 1}
                                            onNavigate={onNavigate}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </section>
        </div>
    );
};

export default Dashboard;
