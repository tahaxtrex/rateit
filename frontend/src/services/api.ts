// API Service - Wrapper for backend API calls

const API_BASE = '/api';

// Universities
export const fetchUniversities = async () => {
    const res = await fetch(`${API_BASE}/universities`);
    if (!res.ok) throw new Error('Failed to fetch universities');
    return res.json();
};

export const fetchUniversity = async (id: string) => {
    const res = await fetch(`${API_BASE}/universities/${id}`);
    if (!res.ok) throw new Error('Failed to fetch university');
    return res.json();
};

export const createUniversity = async (data: {
    name: string;
    location: string;
    country: string;
    description?: string;
    imageUrl?: string;
}) => {
    const res = await fetch(`${API_BASE}/universities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create university');
    return res.json();
};

// Reviews
export const fetchReviews = async (universityId?: string) => {
    const url = universityId
        ? `${API_BASE}/reviews?universityId=${universityId}`
        : `${API_BASE}/reviews`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch reviews');
    return res.json();
};

export const fetchCategories = async () => {
    const res = await fetch(`${API_BASE}/reviews/categories`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
};

export const submitReview = async (data: {
    universityId: string;
    category: string;
    rating: number;
    comment: string;
}) => {
    const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to submit review');
    return result;
};

// AI Chat
export const sendAIChat = async (query: string, universityId?: string) => {
    const body: { query: string; universityId?: string } = { query };
    if (universityId) {
        body.universityId = universityId;
    }
    const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to get AI response');
    return res.json();
};

// Rankings (Dashboard)
export const fetchRankings = async () => {
    const res = await fetch(`${API_BASE}/rankings`);
    if (!res.ok) throw new Error('Failed to fetch rankings');
    return res.json();
};

// Compare Schools
export const compareSchools = async (universityId1: string, universityId2: string) => {
    const res = await fetch(`${API_BASE}/ai/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universityId1, universityId2 }),
    });
    if (!res.ok) throw new Error('Failed to compare schools');
    return res.json();
};
