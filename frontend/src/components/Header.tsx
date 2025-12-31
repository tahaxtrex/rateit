import React, { useState } from 'react';

interface HeaderProps {
    currentRoute: string;
    onNavigate: (route: 'home' | 'ask' | 'reviews' | 'add-school') => void;
}

const Header: React.FC<HeaderProps> = ({ currentRoute, onNavigate }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navItems = [
        { id: 'home', label: 'Home' },
        { id: 'ask', label: 'Ask AI' },
        { id: 'reviews', label: 'Reviews' },
        { id: 'add-school', label: 'Add School' },
    ];

    const handleNav = (route: string) => {
        onNavigate(route as any);
        setMobileMenuOpen(false);
    };

    return (
        <>
            <header style={{
                position: 'sticky',
                top: 0,
                zIndex: 100,
                background: 'rgba(10, 10, 26, 0.95)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
                <div className="container" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: '72px',
                }}>
                    {/* Logo */}
                    <div
                        onClick={() => handleNav('home')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                        }}
                    >
                        <div style={{
                            width: '40px',
                            height: '40px',
                            background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                <path d="M2 17l10 5 10-5" />
                                <path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <span style={{
                            fontSize: '1.5rem',
                            fontWeight: 800,
                            letterSpacing: '-0.02em',
                        }}>
                            <span style={{ color: 'white' }}>RATE</span>
                            <span className="text-gradient">IT</span>
                        </span>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="desktop-nav" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}>
                        {navItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleNav(item.id)}
                                style={{
                                    padding: '10px 20px',
                                    background: currentRoute === item.id
                                        ? 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)'
                                        : 'transparent',
                                    border: currentRoute === item.id
                                        ? 'none'
                                        : '1px solid transparent',
                                    borderRadius: '9999px',
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    fontWeight: currentRoute === item.id ? 600 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 150ms ease',
                                }}
                                onMouseEnter={(e) => {
                                    if (currentRoute !== item.id) {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (currentRoute !== item.id) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.borderColor = 'transparent';
                                    }
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    {/* Mobile Menu Button */}
                    <button
                        className="mobile-menu-btn"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        style={{
                            display: 'none',
                            padding: '8px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                        aria-label="Toggle menu"
                    >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                            {mobileMenuOpen ? (
                                <path d="M18 6L6 18M6 6l12 12" />
                            ) : (
                                <>
                                    <path d="M3 12h18" />
                                    <path d="M3 6h18" />
                                    <path d="M3 18h18" />
                                </>
                            )}
                        </svg>
                    </button>
                </div>
            </header>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div
                    className="mobile-menu-overlay"
                    style={{
                        position: 'fixed',
                        top: '72px',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(10, 10, 26, 0.98)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        zIndex: 99,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '24px',
                        gap: '8px',
                        animation: 'slideDown 200ms ease',
                    }}
                >
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => handleNav(item.id)}
                            style={{
                                padding: '16px 20px',
                                background: currentRoute === item.id
                                    ? 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)'
                                    : 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '1rem',
                                fontWeight: currentRoute === item.id ? 600 : 500,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 150ms ease',
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}

            <style>{`
                @media (max-width: 768px) {
                    .desktop-nav {
                        display: none !important;
                    }
                    .mobile-menu-btn {
                        display: block !important;
                    }
                }
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </>
    );
};

export default Header;
