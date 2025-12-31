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
            <section style={{ padding: '40px 0 20px', textAlign: 'center' }}>
                <div className="container">
                    <h1 className="heading-lg" style={{ marginBottom: '12px' }}>
                        <span className="text-gradient">Ask AI</span> About Universities
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                        Ask questions about any university in our database. Compare schools, find the best options for you, or deep dive into a specific campus. Our AI analyzes real student reviews to give you honest answers.
                    </p>
                </div>
            </section>

            {/* Chat Section - Global Mode */}
            <section className="container" style={{ paddingBottom: '40px' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    {loading ? (
                        <div className="glass-card" style={{
                            height: '500px',
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

            {/* Example Questions */}
            <section className="container" style={{ paddingBottom: '60px' }}>
                <div style={{
                    maxWidth: '800px',
                    margin: '0 auto',
                }}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: 'var(--accent-secondary)',
                            marginBottom: '16px',
                        }}>
                            💡 Try asking...
                        </h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                            gap: '12px',
                        }}>
                            {[
                                { icon: '🏆', text: 'Which university has the best food in Morocco?' },
                                { icon: '🔒', text: 'What schools are safest for women?' },
                                { icon: '💰', text: 'Compare cost of living at universities in Kenya' },
                                { icon: '🎓', text: 'Which school has the best academics?' },
                                { icon: '🏠', text: 'Tell me about dorms at Al Akhawayn' },
                                { icon: '🌍', text: 'Best universities in Central Asia?' },
                            ].map((tip, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)',
                                    padding: '8px 12px',
                                    background: 'rgba(108, 92, 231, 0.1)',
                                    borderRadius: '8px',
                                }}>
                                    <span style={{ fontSize: '1.2rem' }}>{tip.icon}</span>
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
