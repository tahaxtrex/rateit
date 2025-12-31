import React from 'react';

interface StarRatingProps {
    rating: number;
    size?: 'sm' | 'md' | 'lg';
    interactive?: boolean;
    onRatingChange?: (rating: number) => void;
}

const StarRating: React.FC<StarRatingProps> = ({
    rating,
    size = 'md',
    interactive = false,
    onRatingChange,
}) => {
    const stars = [1, 2, 3, 4, 5];

    const sizeMap = {
        sm: 16,
        md: 20,
        lg: 28,
    };

    const starSize = sizeMap[size];

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {stars.map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={!interactive}
                    onClick={() => interactive && onRatingChange?.(star)}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: interactive ? 'pointer' : 'default',
                        transition: 'transform 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                        if (interactive) {
                            e.currentTarget.style.transform = 'scale(1.2)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    <svg
                        width={starSize}
                        height={starSize}
                        viewBox="0 0 24 24"
                        fill={star <= rating ? '#fbbf24' : 'none'}
                        stroke={star <= rating ? '#fbbf24' : 'rgba(255,255,255,0.3)'}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                </button>
            ))}
        </div>
    );
};

export default StarRating;
