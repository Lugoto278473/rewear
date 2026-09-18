import React, { useEffect, useState } from 'react';
import { supabase, isDemo } from '../supabaseClient';
import Auth from './Auth';
import Dashboard from './Dashboard';
import SetupNotice from './SetupNotice';
import '../styles/App.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (showSetup) return <SetupNotice onDismiss={() => setShowSetup(false)} />;
  if (loading) return <div className="loading">Loading ReWear</div>;

  return (
    <div className="App">
      {isDemo && (
        <div className="demo-banner">
          <span>
            <strong>Demo mode</strong> — data lives in your browser, not a
            database.
          </span>
          <button onClick={() => setShowSetup(true)}>
            Connect Supabase
          </button>
        </div>
      )}
      {!session ? <Auth /> : <Dashboard session={session} />}
    </div>
  );
}

export default App;
