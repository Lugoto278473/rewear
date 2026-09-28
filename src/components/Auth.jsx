import React, { useState } from 'react';
import { supabase, isDemo } from '../supabaseClient';
import '../styles/Auth.css';

export default function Auth({ onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      // The on_auth_user_created trigger creates the profile row and derives
      // the username from the email when none is given.
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      // With email confirmation off, sign-up returns a session and the user is
      // already signed in.
      if (data?.session) return;

      setMessage('Almost there — check your email to confirm your account.');
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" onClick={onClose}>
      <div className="auth-box" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h1>ReWear</h1>
        <p className="tagline">Buy & sell secondhand. Any age. Fresh finds.</p>

        {isDemo && (
          <p className="demo-hint">
            Demo: sign up with any email, or sign in as{' '}
            <code>ada@example.com</code> with any password.
          </p>
        )}

        <form onSubmit={isSignUp ? handleSignUp : handleSignIn}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="show-password"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
                {showPassword && <line x1="3" y1="3" x2="21" y2="21" />}
              </svg>
            </button>
          </div>

          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <button
          className="toggle-btn"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError('');
            setMessage('');
          }}
        >
          {isSignUp ? 'Already have an account? Sign In' : 'New here? Sign Up'}
        </button>
      </div>
    </div>
  );
}
