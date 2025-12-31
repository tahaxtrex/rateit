import React, { useState, useEffect } from 'react';
import { fetchUniversities, compareSchools } from '../services/api';

interface University {
    id: string;
    name: string;
    location: string;
    country: string;
    avgRating: number;
    reviewCount: number;
}

interface CompareSchoolsProps {
    onNavigate: (route: 'home' | 'ask' | 'reviews' | 'add-school' | 'university' | 'dashboard' | 'compare', universityId?: string) => void;
}

const CompareSchools: React.FC<CompareSchoolsProps> = ({ onNavigate: _onNavigate }) => {
    const [universities, setUniversities] = useState<University[]>([]);
    const [selectedUni1, setSelectedUni1] = useState<string>('');
    const [selectedUni2, setSelectedUni2] = useState<string>('');
    const [comparison, setComparison] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [loadingUnis, setLoadingUnis] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchUniversities()
            .then(setUniversities)
            .catch(console.error)
            .finally(() => setLoadingUnis(false));
    }, []);

    const handleCompare = async () => {
        if (!selectedUni1 || !selectedUni2) {
            setError('Please select two universities to compare');
            return;
        }
        if (selectedUni1 === selectedUni2) {
            setError('Please select two different universities');
            return;
        }

        setError('');
        setLoading(true);
        setComparison(null);

        try {
            const result = await compareSchools(selectedUni1, selectedUni2);
            setComparison(result);
        } catch (err: any) {
            setError(err.message || 'Failed to compare schools');
        } finally {
            setLoading(false);
        }
    };

    // Note: onNavigate is available for future navigation features

    return (
        <div style={{ minHeight: 'calc(100vh - 72px)' }}>
            {/* Header */}
            <section style={{ padding: '40px 0 20px', textAlign: 'center' }}>
                <div className="container">
                    <h1 className="heading-lg" style={{ marginBottom: '12px' }}>
                        ⚖️ <span className="text-gradient">Compare Schools</span>
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                        Select two universities to get an AI-powered side-by-side comparison based on real student reviews.
                    </p>
                </div>
            </section>

            {/* Selection */}
            <section className="container">
                <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto 1fr',
                        gap: '20px',
                        alignItems: 'center',
                    }}>
                        {/* University 1 */}
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '0.85rem',
                                marginBottom: '8px',
                                color: 'var(--text-secondary)',
                            }}>
                                First University
                            </label>
                            <select
                                value={selectedUni1}
                                onChange={(e) => setSelectedUni1(e.target.value)}
                                className="glass-select"
                                disabled={loadingUnis}
                            >
                                <option value="">Select a university...</option>
                                {universities.map(uni => (
                                    <option key={uni.id} value={uni.id}>
                                        {uni.name} ({uni.country})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* VS */}
                        <div style={{
                            fontSize: '1.5rem',
                            fontWeight: 800,
                            color: 'var(--text-muted)',
                        }}>
                            VS
                        </div>

                        {/* University 2 */}
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '0.85rem',
                                marginBottom: '8px',
                                color: 'var(--text-secondary)',
                            }}>
                                Second University
                            </label>
                            <select
                                value={selectedUni2}
                                onChange={(e) => setSelectedUni2(e.target.value)}
                                className="glass-select"
                                disabled={loadingUnis}
                            >
                                <option value="">Select a university...</option>
                                {universities.map(uni => (
                                    <option key={uni.id} value={uni.id}>
                                        {uni.name} ({uni.country})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            background: 'rgba(255, 107, 107, 0.1)',
                            border: '1px solid rgba(255, 107, 107, 0.3)',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px',
                            marginTop: '16px',
                            color: '#ff6b6b',
                            textAlign: 'center',
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Compare Button */}
                    <button
                        className="btn-primary"
                        onClick={handleCompare}
                        disabled={loading || !selectedUni1 || !selectedUni2}
                        style={{
                            width: '100%',
                            marginTop: '20px',
                            padding: '16px',
                            opacity: (loading || !selectedUni1 || !selectedUni2) ? 0.6 : 1,
                        }}
                    >
                        {loading ? '🤖 Generating Comparison...' : '⚡ Compare Universities'}
                    </button>
                </div>
            </section>

            {/* Loading State */}
            {loading && (
                <section className="container">
                    <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto 20px' }} />
                        <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                            AI is analyzing reviews and generating comparison...
                        </p>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            This may take a few seconds
                        </p>
                    </div>
                </section>
            )}

            {/* Comparison Results */}
            {comparison && !loading && (
                <section className="container" style={{ paddingBottom: '60px' }}>
                    {/* Side by Side Stats */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '20px',
                        marginBottom: '24px',
                    }}>
                        {/* University 1 Stats */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <h3 style={{
                                fontSize: '1.2rem',
                                fontWeight: 700,
                                marginBottom: '8px',
                                background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}>
                                {comparison.university1.university.name}
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                📍 {comparison.university1.university.location}, {comparison.university1.university.country}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>
                                    {comparison.university1.stats.averageRating?.toFixed(1) || '0.0'}
                                </span>
                                <span style={{ color: 'var(--text-secondary)' }}>/ 5.0</span>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {comparison.university1.stats.totalReviews || 0} reviews
                            </p>
                        </div>

                        {/* University 2 Stats */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <h3 style={{
                                fontSize: '1.2rem',
                                fontWeight: 700,
                                marginBottom: '8px',
                                background: 'linear-gradient(135deg, #00d9a0, #00b894)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}>
                                {comparison.university2.university.name}
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                📍 {comparison.university2.university.location}, {comparison.university2.university.country}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>
                                    {comparison.university2.stats.averageRating?.toFixed(1) || '0.0'}
                                </span>
                                <span style={{ color: 'var(--text-secondary)' }}>/ 5.0</span>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {comparison.university2.stats.totalReviews || 0} reviews
                            </p>
                        </div>
                    </div>

                    {/* AI Comparison */}
                    <div className="glass-card" style={{ padding: '32px' }}>
                        <h3 style={{
                            fontSize: '1.2rem',
                            fontWeight: 700,
                            marginBottom: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                        }}>
                            <span style={{
                                width: '40px',
                                height: '40px',
                                background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                🤖
                            </span>
                            AI Analysis
                        </h3>
                        <div style={{
                            fontSize: '1rem',
                            lineHeight: 1.8,
                            color: 'var(--text-primary)',
                            whiteSpace: 'pre-wrap',
                        }}>
                            {comparison.comparison}
                        </div>
                    </div>
                </section>
            )}

            {/* Empty State */}
            {!comparison && !loading && (
                <section className="container" style={{ paddingBottom: '60px' }}>
                    <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎓 ⚖️ 🎓</div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '12px' }}>
                            Select two universities to compare
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                            Our AI will analyze student reviews and give you a detailed breakdown of how each school performs across different categories.
                        </p>
                    </div>
                </section>
            )}
        </div>
    );
};

export default CompareSchools;
