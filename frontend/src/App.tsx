import React, { useState } from 'react';
import Header from './components/Header';
import Home from './pages/Home';
import Ask from './pages/Ask';
import Reviews from './pages/Reviews';
import AddSchool from './pages/AddSchool';
import UniversityProfile from './pages/UniversityProfile';

type Route = 'home' | 'ask' | 'reviews' | 'add-school' | 'university';

const App: React.FC = () => {
    const [route, setRoute] = useState<Route>('home');
    const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(null);

    const navigate = (newRoute: Route, universityId?: string) => {
        setRoute(newRoute);
        if (universityId) {
            setSelectedUniversityId(universityId);
        }
        window.scrollTo(0, 0);
    };

    return (
        <>
            <Header currentRoute={route} onNavigate={navigate} />
            <main style={{ flex: 1 }}>
                {route === 'home' && <Home onNavigate={navigate} />}
                {route === 'ask' && <Ask />}
                {route === 'reviews' && <Reviews onNavigate={navigate} />}
                {route === 'add-school' && <AddSchool onNavigate={navigate} />}
                {route === 'university' && selectedUniversityId && (
                    <UniversityProfile
                        universityId={selectedUniversityId}
                        onNavigate={navigate}
                    />
                )}
            </main>
        </>
    );
};

export default App;
