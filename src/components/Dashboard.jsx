import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import ListingCard from './ListingCard';
import PostListing from './PostListing';
import '../styles/Dashboard.css';

export default function Dashboard({ session }) {
  const [listings, setListings] = useState([]);
  const [view, setView] = useState('browse');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const fetchListings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*, users(username, rating)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;
      setUser(data);
    } catch (err) {
      console.error(err);
    }
  }, [session.user.id]);

  useEffect(() => {
    fetchListings();
    fetchUser();
  }, [fetchListings, fetchUser]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="dashboard">
      <header className="header">
        <h1>ReWear</h1>
        <div className="header-actions">
          <button
            className={view === 'browse' ? 'active' : ''}
            onClick={() => setView('browse')}
          >
            Browse
          </button>
          <button
            className={view === 'post' ? 'active' : ''}
            onClick={() => setView('post')}
          >
            Post Item
          </button>
          <button
            className={view === 'profile' ? 'active' : ''}
            onClick={() => setView('profile')}
          >
            Profile
          </button>
          <button onClick={handleSignOut} className="signout-btn">
            Sign Out
          </button>
        </div>
      </header>

      <main className="content">
        {view === 'browse' && (
          <div className="browse-section">
            <h2>Browse Items</h2>
            {loading ? (
              <p>Loading...</p>
            ) : listings.length === 0 ? (
              <p>No items yet. Be the first to post!</p>
            ) : (
              <div className="listings-grid">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'post' && <PostListing onListingCreated={fetchListings} />}

        {view === 'profile' && user && (
          <div className="profile-section">
            <h2>{user.username}</h2>
            <p>Email: {session.user.email}</p>
            <p>Rating: ⭐ {user.rating || 'No ratings yet'}</p>
            {user.bio && <p>Bio: {user.bio}</p>}
          </div>
        )}
      </main>
    </div>
  );
}
