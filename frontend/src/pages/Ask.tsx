import React, { useEffect, useState } from 'react';
import { University } from '../types';
import { fetchUniversities } from '../services/api';
import AIChat from '../components/AIChat';

const Ask: React.FC = () => {
    const [universities, setUniversities] = useState<University[]>([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div style={{ minHeight: 'calc(100vh - 72px)' }}>
            {/* Header */}
            <section style={{ padding: '24px 0 16px', textAlign: 'center' }}>
                <div className="container">
                    <h1 className="heading-lg" style={{ marginBottom: '8px' }}>
                        <span className="text-gradient">Ask AI</span> About Universities
                    </h1>
                    <p style={{
                        color: 'var(--text-secondary)',
                        maxWidth: '600px',
                        margin: '0 auto',
                        fontSize: '0.9rem',
                        padding: '0 16px',
                    }}>
                        Ask questions about any university. Our AI analyzes real student reviews.
                    </p>
                </div>
            </section>

            {/* Chat Section - Global Mode */}
            <section className="container" style={{ paddingBottom: '20px' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    {loading ? (
                        <div className="glass-card" style={{
                            height: '400px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <div className="spinner" />
                        </div>
                    ) : (
                        <AIChat
                            universities={universities}
                            fullPage={true}
                            globalMode={true}  // Enable global chat mode
                        />
                    )}
                </div>
            </section>

            {/* Example Questions - Hidden on very small screens to save space */}
            <section className="container tips-section-wrapper" style={{ paddingBottom: '40px' }}>
                <div style={{
                    maxWidth: '800px',
                    margin: '0 auto',
                }}>
                    <div className="glass-card tips-section" style={{ padding: '20px' }}>
                        <h3 style={{
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            color: 'var(--accent-secondary)',
                            marginBottom: '12px',
                        }}>
                            💡 Try asking...
                        </h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '10px',
                        }}>
                            {[
                                { icon: '🏆', text: 'Best food in Morocco?' },
                                { icon: '🔒', text: 'Safest schools for women?' },
                                { icon: '💰', text: 'Cheapest universities?' },
                                { icon: '🎓', text: 'Best academics?' },
                            ].map((tip, i) => (
                                <div key={i} className="tip-item" style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)',
                                    padding: '8px 12px',
                                    background: 'rgba(108, 92, 231, 0.1)',
                                    borderRadius: '8px',
                                }}>
                                    <span style={{ fontSize: '1.1rem' }}>{tip.icon}</span>
                                    {tip.text}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Ask;
