import React, { useState } from 'react';
import { supabase, isDemo } from '../supabaseClient';
import '../styles/Auth.css';

export default function Auth({ onClose, onShowTerms, isRecovery, onRecoveryComplete }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState(isRecovery ? 'reset' : 'signin'); // 'signin' | 'signup' | 'forgot' | 'reset'
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

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

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;
      setMessage('Password reset link sent! Please check your email inbox.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setMessage('Password updated successfully! Logging you in...');
      setTimeout(() => {
        if (onRecoveryComplete) onRecoveryComplete();
        onClose();
      }, 1500);
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
        <p className="tagline">
          {mode === 'forgot'
            ? 'Enter your email to receive a password reset link.'
            : mode === 'reset'
            ? 'Enter your new password below.'
            : 'Buy & sell secondhand. Any age. Fresh finds.'}
        </p>

        {isDemo && (
          <p className="demo-hint">
            Demo: sign up with any email, or sign in as{' '}
            <code>ada@example.com</code> with any password.
          </p>
        )}

        {/* FORGOT PASSWORD FORM */}
        {mode === 'forgot' && (
          <form onSubmit={handleResetRequest}>
            <input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />

            {error && <p className="error">{error}</p>}
            {message && <p className="success">{message}</p>}

            <button type="submit" disabled={loading}>
              {loading ? 'Sending link...' : 'Send Reset Link'}
            </button>

            <button
              type="button"
              className="toggle-btn"
              onClick={() => {
                setMode('signin');
                setError('');
                setMessage('');
              }}
            >
              ← Back to Sign In
            </button>
          </form>
        )}

        {/* SET NEW PASSWORD FORM (FROM EMAIL LINK) */}
        {mode === 'reset' && (
          <form onSubmit={handleUpdatePassword}>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="New password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
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

            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="error">{error}</p>}
            {message && <p className="success">{message}</p>}

            <button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}

        {/* SIGN IN & SIGN UP FORMS */}
        {(mode === 'signin' || mode === 'signup') && (
          <form onSubmit={mode === 'signup' ? handleSignUp : handleSignIn}>
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

            {mode === 'signin' && (
              <div className="forgot-password-row">
                <button
                  type="button"
                  className="forgot-password-btn"
                  onClick={() => {
                    setMode('forgot');
                    setError('');
                    setMessage('');
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && <p className="error">{error}</p>}
            {message && <p className="success">{message}</p>}

            <button type="submit" disabled={loading}>
              {loading ? 'Loading...' : mode === 'signup' ? 'Sign Up' : 'Sign In'}
            </button>

            {mode === 'signup' && (
              <p className="terms-note">
                By signing up you agree to the{' '}
                <button type="button" className="terms-link" onClick={onShowTerms}>
                  Terms and Services
                </button>
                .
              </p>
            )}
          </form>
        )}

        {(mode === 'signin' || mode === 'signup') && (
          <button
            className="toggle-btn"
            onClick={() => {
              setMode(mode === 'signup' ? 'signin' : 'signup');
              setError('');
              setMessage('');
            }}
          >
            {mode === 'signup' ? 'Already have an account? Sign In' : 'New here? Sign Up'}
          </button>
        )}
      </div>
    </div>
  );
}
