import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import ListingCard from './ListingCard';
import PostListing from './PostListing';
import Messages from './Messages';
import '../styles/Dashboard.css';

// The browse grid always shows at least this many spots.
const MIN_SPOTS = 8;

export default function Dashboard({ session, onLogin }) {
  const [listings, setListings] = useState([]);
  const [view, setView] = useState('browse');
  // A conversation to open in Messages, started from a listing's Inquire.
  const [draft, setDraft] = useState(null);
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

  const userId = session?.user.id;

  const fetchUser = useCallback(async () => {
    if (!userId) {
      setUser(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUser(data);
    } catch (err) {
      console.error(err);
    }
  }, [userId]);

  useEffect(() => {
    fetchListings();
    fetchUser();
  }, [fetchListings, fetchUser]);

  // Visitors can browse freely; selling and messaging need an account.
  const goTo = (next) => {
    if (next !== 'browse' && !session) {
      onLogin();
      return;
    }
    setView(next);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setView('browse');
  };

  const handleInquire = (listing) => {
    if (!session) {
      onLogin();
      return;
    }
    setDraft({
      listingId: listing.id,
      listingTitle: listing.title,
      otherId: listing.seller_id,
      otherName: listing.users?.username,
    });
    setView('messages');
  };

  return (
    <div className="dashboard">
      <header className="header">
        <h1>ReWear</h1>
        <div className="header-actions">
          <button
            className={view === 'browse' ? 'active' : ''}
            onClick={() => goTo('browse')}
          >
            Browse
          </button>
          <button
            className={view === 'post' ? 'active' : ''}
            onClick={() => goTo('post')}
          >
            Post Item
          </button>
          <button
            className={view === 'messages' ? 'active' : ''}
            onClick={() => {
              setDraft(null);
              goTo('messages');
            }}
          >
            Messages
          </button>
          {session ? (
            <>
              <button
                className={view === 'profile' ? 'active' : ''}
                onClick={() => goTo('profile')}
              >
                Profile
              </button>
              <button onClick={handleSignOut} className="signout-btn">
                Sign Out
              </button>
            </>
          ) : (
            <button onClick={onLogin} className="login-btn">
              Log in
            </button>
          )}
        </div>
      </header>

      <main className="content">
        {view === 'browse' && (
          <div className="browse-section">
            <h2>Browse Items</h2>
            {!loading && listings.length === 0 && (
              <p>No items yet. Be the first to post!</p>
            )}
            <div className="listings-grid">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isOwn={listing.seller_id === userId}
                  onInquire={handleInquire}
                />
              ))}
              {/* Top up a sparse shop with empty spots that invite selling. */}
              {Array.from(
                { length: Math.max(0, MIN_SPOTS - listings.length) },
                (_, i) => (
                  <button
                    key={`empty-${i}`}
                    className="empty-spot"
                    onClick={() => goTo('post')}
                  >
                    <span>+</span>
                    Sell an item
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {view === 'post' && session && <PostListing onListingCreated={fetchListings} />}

        {view === 'messages' && session && <Messages session={session} draft={draft} />}

        {view === 'profile' && session && user && (
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
