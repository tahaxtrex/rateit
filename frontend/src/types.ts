export enum Category {
    ACADEMICS = 'Academics',
    DORMS = 'Dorms & Housing',
    FOOD = 'Food & Dining',
    SOCIAL = 'Social Life',
    ADMIN = 'Administration',
    COST = 'Cost of Living',
    SAFETY = 'Safety',
    CAREER = 'Career Support',
    OTHER = 'Other'
}

export interface University {
    id: string;
    name: string;
    location: string;
    country: string;
    description: string;
    imageUrl: string;
    avgRating?: number;
    reviewCount?: number;
}

export interface Review {
    id: string;
    universityId: string;
    category: Category | string;
    rating: number;
    comment: string;
    createdAt: string;
    flagged?: boolean;
}

export interface AggregatedStats {
    universityId: string;
    totalReviews: number;
    averageRating: number;
    categoryBreakdown: Record<string, { count: number; average: number }>;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: number;
    isError?: boolean;
}
