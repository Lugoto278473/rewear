import React, { useEffect, useState } from 'react';
import { supabase, isDemo } from '../supabaseClient';
import Auth from './Auth';
import Dashboard from './Dashboard';
import SetupNotice from './SetupNotice';
import Terms from './Terms';
import '../styles/App.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Close the log-in popup once someone signs in.
      if (session) setShowAuth(false);
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
      <Dashboard session={session} onLogin={() => setShowAuth(true)} />
      {showAuth && !session && (
        <Auth
          onClose={() => setShowAuth(false)}
          onShowTerms={() => setShowTerms(true)}
        />
      )}
      <footer className="site-footer">
        <div className="footer-brand">
          <strong>ReWear</strong>
          <span>Buy & sell secondhand. Any age. Fresh finds.</span>
        </div>
        <nav className="footer-links">
          <button onClick={() => setShowTerms(true)}>Terms and Services</button>
        </nav>
        <p className="footer-copy">
          © {new Date().getFullYear()} ReWear. All rights reserved.
        </p>
      </footer>
      {showTerms && <Terms onClose={() => setShowTerms(false)} />}
    </div>
  );
}

export default App;
