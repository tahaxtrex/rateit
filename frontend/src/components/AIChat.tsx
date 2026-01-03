import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, University } from '../types';
import { sendAIChat } from '../services/api';

interface AIChatProps {
    universities: University[];
    selectedUniversityId?: string;
    onUniversityChange?: (id: string) => void;
    fullPage?: boolean;
    globalMode?: boolean; // New: allows chat without selecting a university
}

const AIChat: React.FC<AIChatProps> = ({
    universities,
    selectedUniversityId,
    onUniversityChange,
    fullPage = false,
    globalMode = false,
}) => {
    const [uniId, setUniId] = useState(selectedUniversityId || '');
    const [query, setQuery] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    const selectedUni = universities.find(u => u.id === uniId);

    useEffect(() => {
        if (selectedUniversityId) {
            setUniId(selectedUniversityId);
        }
    }, [selectedUniversityId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Welcome message
    useEffect(() => {
        if (messages.length === 0) {
            if (globalMode) {
                setMessages([{
                    id: 'welcome',
                    role: 'assistant',
                    text: `Hey! 👋 I'm your AI assistant for university insights. Ask me anything about universities in our database - like "Which school has the best food in Morocco?" or "Compare universities in Kenya". I'll give you the real scoop based on actual student reviews!`,
                    timestamp: Date.now(),
                }]);
            } else if (selectedUni) {
                setMessages([{
                    id: 'welcome',
                    role: 'assistant',
                    text: `Hey! 👋 I'm your AI assistant for ${selectedUni.name}. Ask me anything about student life, dorms, food, academics, or safety - I'll give you the real scoop based on actual student reviews!`,
                    timestamp: Date.now(),
                }]);
            }
        }
    }, [selectedUni, globalMode]);

    const handleSend = async () => {
        // In global mode, we don't need uniId
        if (!query.trim() || isThinking) return;
        if (!globalMode && !uniId) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: query,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, userMsg]);
        setQuery('');
        setIsThinking(true);

        try {
            // Pass universityId only if not in global mode and a uni is selected
            const { response } = await sendAIChat(query, globalMode ? undefined : uniId);

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: response,
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (err) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: "Oops! I'm having trouble analyzing the data right now. Please try again in a moment.",
                timestamp: Date.now(),
                isError: true,
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleUniChange = (newId: string) => {
        setUniId(newId);
        setMessages([]);
        onUniversityChange?.(newId);
    };

    const containerHeight = fullPage ? 'calc(100vh - 180px)' : '500px';
    const mobileContainerHeight = fullPage ? 'calc(100dvh - 140px)' : '450px';

    // Determine if input should be enabled
    const inputEnabled = globalMode || !!uniId;

    return (
        <div className="glass-card ai-chat-container" style={{
            display: 'flex',
            flexDirection: 'column',
            height: containerHeight,
            minHeight: '350px',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div className="ai-chat-header" style={{
                padding: '16px 20px',
                background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '10px',
                        height: '10px',
                        background: '#00d9a0',
                        borderRadius: '50%',
                        animation: 'pulse 2s infinite',
                    }} />
                    <h3 style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        {globalMode ? 'AI University Explorer' : 'AI Insights Assistant'}
                    </h3>
                </div>
                <span style={{
                    fontSize: '0.7rem',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                }}>
                    {globalMode ? 'Global' : 'Beta'}
                </span>
            </div>

            {/* University Selector (only if not global mode and universities provided) */}
            {!globalMode && universities.length > 0 && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
                    <select
                        value={uniId}
                        onChange={(e) => handleUniChange(e.target.value)}
                        className="glass-select"
                        style={{ padding: '10px 16px' }}
                    >
                        <option value="">Select a university...</option>
                        {universities.map(uni => (
                            <option key={uni.id} value={uni.id}>{uni.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Messages */}
            <div
                ref={scrollRef}
                className="ai-chat-messages"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    minHeight: 0,
                }}
            >
                {!globalMode && !uniId && (
                    <div style={{
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        padding: '40px 20px',
                    }}>
                        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🎓</div>
                        <p>Select a university above to start asking questions!</p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        style={{
                            display: 'flex',
                            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        }}
                    >
                        <div
                            className="ai-chat-message"
                            style={{
                                maxWidth: '85%',
                                padding: '12px 16px',
                                borderRadius: msg.role === 'user'
                                    ? '16px 16px 4px 16px'
                                    : '16px 16px 16px 4px',
                                background: msg.role === 'user'
                                    ? 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)'
                                    : msg.isError
                                        ? 'rgba(255, 107, 107, 0.2)'
                                        : 'var(--glass-bg)',
                                border: msg.role === 'user'
                                    ? 'none'
                                    : '1px solid var(--glass-border)',
                                fontSize: '0.9rem',
                                lineHeight: 1.5,
                                wordBreak: 'break-word',
                            }}
                        >
                            {msg.role === 'assistant' && !msg.isError && (
                                <div style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: 'var(--accent-secondary)',
                                    marginBottom: '6px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}>
                                    AI Summary
                                </div>
                            )}
                            {msg.text}
                        </div>
                    </div>
                ))}

                {isThinking && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{
                            padding: '16px 20px',
                            borderRadius: '16px 16px 16px 4px',
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            display: 'flex',
                            gap: '6px',
                        }}>
                            {[0, 1, 2].map(i => (
                                <div
                                    key={i}
                                    style={{
                                        width: '8px',
                                        height: '8px',
                                        background: 'var(--accent-primary)',
                                        borderRadius: '50%',
                                        animation: `bounce 1.4s infinite ${i * 0.16}s`,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Disclaimer */}
            <div className="ai-chat-disclaimer" style={{
                padding: '8px 16px',
                background: 'rgba(0,0,0,0.2)',
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                flexShrink: 0,
            }}>
                AI-generated summaries based on anonymous student submissions. Verify independently.
            </div>

            {/* Input */}
            <div className="ai-chat-input-container" style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--glass-border)',
                display: 'flex',
                gap: '10px',
                flexShrink: 0,
            }}>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={
                        globalMode
                            ? "Ask about any university..."
                            : uniId
                                ? "Ask about food, safety, dorms..."
                                : "Select a university first..."
                    }
                    disabled={!inputEnabled || isThinking}
                    className="glass-input ai-chat-input"
                    style={{
                        flex: 1,
                        padding: '12px 16px',
                        fontSize: '16px',
                        minHeight: '48px',
                    }}
                />
                <button
                    onClick={handleSend}
                    disabled={!query.trim() || isThinking || !inputEnabled}
                    className="btn-primary ai-chat-send-btn"
                    style={{
                        padding: '0',
                        width: '48px',
                        minWidth: '48px',
                        maxWidth: '48px',
                        height: '48px',
                        minHeight: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 2L11 13" />
                        <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                    </svg>
                </button>
            </div>

            <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @media (max-width: 480px) {
          .ai-chat-container {
            height: ${mobileContainerHeight} !important;
          }
        }
      `}</style>
        </div>
    );
};

export default AIChat;
