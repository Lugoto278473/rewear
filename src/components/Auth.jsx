import React, { useState } from 'react';
import { supabase, isDemo } from '../supabaseClient';
import '../styles/Auth.css';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
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
      const { data: taken, error: lookupError } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (lookupError) throw lookupError;
      if (taken) throw new Error('That username is taken. Try another.');

      // The profile row is created by the on_auth_user_created trigger, which
      // reads the username from here. A client-side insert can't work: there's
      // no session until the email is confirmed, so RLS would reject it.
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });

      if (authError) throw authError;

      setMessage('Almost there — check your email to confirm your account.');
      setEmail('');
      setPassword('');
      setUsername('');
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
    <div className="auth-container">
      <div className="auth-box">
        <h1>ReWear</h1>
        <p className="tagline">Buy & sell secondhand. Any age. Fresh finds.</p>

        {isDemo && (
          <p className="demo-hint">
            Demo: sign up with any email, or sign in as{' '}
            <code>ada@example.com</code> with any password.
          </p>
        )}

        <form onSubmit={isSignUp ? handleSignUp : handleSignIn}>
          {isSignUp && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

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
