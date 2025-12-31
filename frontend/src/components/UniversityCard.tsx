import React from 'react';
import { University } from '../types';
import StarRating from './StarRating';

interface UniversityCardProps {
    university: University;
    onClick: (id: string) => void;
}

const UniversityCard: React.FC<UniversityCardProps> = ({ university, onClick }) => {
    return (
        <div
            onClick={() => onClick(university.id)}
            className="glass-card"
            style={{
                cursor: 'pointer',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Image */}
            <div style={{
                position: 'relative',
                height: '160px',
                overflow: 'hidden',
            }}>
                <img
                    src={university.imageUrl}
                    alt={university.name}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 400ms ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                />
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)',
                }} />
                <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '16px',
                    right: '16px',
                }}>
                    <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'rgba(255,255,255,0.7)',
                    }}>
                        {university.country}
                    </span>
                    <h3 style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: 'white',
                        marginTop: '4px',
                        lineHeight: 1.2,
                    }}>
                        {university.name}
                    </h3>
                </div>
            </div>

            {/* Content */}
            <div style={{
                padding: '16px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
            }}>
                <p style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    flex: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                }}>
                    {university.description}
                </p>

                {/* Footer */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--glass-border)',
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                {university.avgRating?.toFixed(1) || '-'}
                            </span>
                            <StarRating rating={university.avgRating || 0} size="sm" />
                        </div>
                        <span style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                        }}>
                            {university.reviewCount || 0} reviews
                        </span>
                    </div>
                    <span style={{
                        color: 'var(--accent-secondary)',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                    }}>
                        View →
                    </span>
                </div>
            </div>
        </div>
    );
};

export default UniversityCard;
