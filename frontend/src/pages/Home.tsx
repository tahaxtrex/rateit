import React, { useEffect, useState, useMemo } from 'react';
import { University } from '../types';
import { fetchUniversities } from '../services/api';
import UniversityCard from '../components/UniversityCard';

interface HomeProps {
    onNavigate: (route: 'home' | 'ask' | 'reviews' | 'add-school' | 'university', universityId?: string) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
    const [universities, setUniversities] = useState<University[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [countryFilter, setCountryFilter] = useState<string>('all');
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await fetchUniversities();
                setUniversities(data);
            } catch (err) {
                console.error('Failed to load universities:', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // Get unique countries for filter
    const countries = useMemo(() => {
        const countrySet = new Set(universities.map(u => u.country));
        return Array.from(countrySet).sort();
    }, [universities]);

    // Filter universities
    const filteredUnis = useMemo(() => {
        return universities.filter(u => {
            const matchesSearch = searchTerm === '' ||
                u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.location.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesCountry = countryFilter === 'all' || u.country === countryFilter;

            return matchesSearch && matchesCountry;
        });
    }, [universities, searchTerm, countryFilter]);

    // Limit to 8 unless "Show All" is clicked
    const displayedUnis = showAll ? filteredUnis : filteredUnis.slice(0, 8);

    const totalReviews = universities.reduce((sum, u) => sum + (u.reviewCount || 0), 0);

    return (
        <div>
            {/* Hero Section */}
            <section style={{
                position: 'relative',
                padding: '80px 0 100px',
                overflow: 'hidden',
            }}>
                {/* Background Effects */}
                <div style={{
                    position: 'absolute',
                    top: '-50%',
                    left: '-10%',
                    width: '500px',
                    height: '500px',
                    background: 'radial-gradient(circle, rgba(108, 92, 231, 0.3) 0%, transparent 70%)',
                    filter: 'blur(60px)',
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute',
                    bottom: '-30%',
                    right: '-10%',
                    width: '400px',
                    height: '400px',
                    background: 'radial-gradient(circle, rgba(162, 155, 254, 0.2) 0%, transparent 70%)',
                    filter: 'blur(60px)',
                    pointerEvents: 'none',
                }} />

                <div className="container" style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                        <h1 className="heading-xl" style={{ marginBottom: '24px' }}>
                            Real Student Reviews.
                            <br />
                            <span className="text-gradient">Unfiltered AI Insights.</span>
                        </h1>
                        <p style={{
                            fontSize: '1.1rem',
                            color: 'var(--text-secondary)',
                            marginBottom: '40px',
                            maxWidth: '600px',
                            margin: '0 auto 40px',
                        }}>
                            Get the truth about universities in developing markets. Ask our AI assistant about dorms, safety, and social life based on verified student feedback.
                        </p>

                        {/* Search Bar */}
                        <div style={{
                            position: 'relative',
                            maxWidth: '600px',
                            margin: '0 auto 20px',
                        }}>
                            <input
                                type="text"
                                placeholder="Search by university, city, or country..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setShowAll(false);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '20px 60px 20px 24px',
                                    background: 'var(--glass-bg)',
                                    backdropFilter: 'blur(20px)',
                                    WebkitBackdropFilter: 'blur(20px)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '9999px',
                                    color: 'white',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'all 250ms ease',
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                    e.currentTarget.style.boxShadow = '0 0 30px var(--accent-glow)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            />
                            <div style={{
                                position: 'absolute',
                                right: '8px',
                                top: '8px',
                                width: '44px',
                                height: '44px',
                                background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="M21 21l-4.35-4.35" />
                                </svg>
                            </div>
                        </div>

                        {/* Country Filter */}
                        <div className="filter-pills" style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '8px',
                            flexWrap: 'wrap',
                            maxWidth: '100%',
                            margin: '0 auto',
                            padding: '0 8px',
                        }}>
                            <button
                                onClick={() => { setCountryFilter('all'); setShowAll(false); }}
                                style={{
                                    padding: '8px 16px',
                                    background: countryFilter === 'all' ? 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)' : 'var(--glass-bg)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '9999px',
                                    color: 'white',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 200ms ease',
                                }}
                            >
                                All Countries
                            </button>
                            {countries.map(country => (
                                <button
                                    key={country}
                                    onClick={() => { setCountryFilter(country); setShowAll(false); }}
                                    style={{
                                        padding: '8px 16px',
                                        background: countryFilter === country ? 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)' : 'var(--glass-bg)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '9999px',
                                        color: 'white',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        transition: 'all 200ms ease',
                                    }}
                                >
                                    {country}
                                </button>
                            ))}
                        </div>

                        {/* Stats */}
                        <div className="stats-row" style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '32px',
                            marginTop: '48px',
                            flexWrap: 'wrap',
                        }}>
                            <div>
                                <div style={{ fontSize: '2rem', fontWeight: 700 }} className="text-gradient">
                                    {universities.length}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Universities
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '2rem', fontWeight: 700 }} className="text-gradient">
                                    {totalReviews}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Student Reviews
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '2rem', fontWeight: 700 }} className="text-gradient">
                                    100%
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Anonymous
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Universities Grid */}
            <section className="container" style={{ paddingBottom: '80px' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '32px',
                }}>
                    <h2 className="heading-md">Featured Universities</h2>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Showing {displayedUnis.length} of {filteredUnis.length} results
                    </span>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map(i => (
                            <div
                                key={i}
                                className="glass-card"
                                style={{ height: '320px', animation: 'pulse 2s infinite' }}
                            />
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: '24px' }}>
                            {displayedUnis.map(uni => (
                                <UniversityCard
                                    key={uni.id}
                                    university={uni}
                                    onClick={(id) => onNavigate('university', id)}
                                />
                            ))}
                            {filteredUnis.length === 0 && (
                                <div style={{
                                    gridColumn: '1 / -1',
                                    textAlign: 'center',
                                    padding: '60px 20px',
                                    color: 'var(--text-muted)',
                                }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
                                    <p>No universities found. Try a different search term.</p>
                                    <button
                                        onClick={() => onNavigate('add-school')}
                                        className="btn-primary"
                                        style={{ marginTop: '20px' }}
                                    >
                                        Add Your University
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Show More Button */}
                        {!showAll && filteredUnis.length > 8 && (
                            <div style={{ textAlign: 'center', marginTop: '40px' }}>
                                <button
                                    onClick={() => setShowAll(true)}
                                    style={{
                                        padding: '12px 32px',
                                        background: 'var(--glass-bg)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '9999px',
                                        color: 'white',
                                        fontSize: '0.95rem',
                                        cursor: 'pointer',
                                        transition: 'all 200ms ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                        e.currentTarget.style.background = 'rgba(108, 92, 231, 0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--glass-border)';
                                        e.currentTarget.style.background = 'var(--glass-bg)';
                                    }}
                                >
                                    Show All {filteredUnis.length} Universities →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* CTA Section */}
            <section style={{
                padding: '60px 0',
                borderTop: '1px solid var(--glass-border)',
            }}>
                <div className="container" style={{ textAlign: 'center' }}>
                    <h2 className="heading-md" style={{ marginBottom: '16px' }}>
                        Can't find your university?
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                        Help other students by adding your school and sharing your experience.
                    </p>
                    <button
                        onClick={() => onNavigate('add-school')}
                        className="btn-primary"
                    >
                        Add Your University →
                    </button>
                </div>
            </section>

            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.3; }
        }
      `}</style>
        </div>
    );
};

export default Home;
