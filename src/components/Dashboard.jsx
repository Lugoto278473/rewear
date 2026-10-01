import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import ListingCard from './ListingCard';
import PostListing from './PostListing';
import Messages from './Messages';
import TransactionList from './TransactionList';
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

  const openConversation = (listing) => {
    setDraft({
      listingId: listing.id,
      listingTitle: listing.title,
      otherId: listing.seller_id,
      otherName: listing.users?.username,
    });
    setView('messages');
  };

  // Ignores repeat clicks while a purchase or offer is in flight.
  const busy = useRef(false);

  const handleBuyNow = async (listing) => {
    if (!session) {
      onLogin();
      return;
    }
    if (busy.current) return;
    busy.current = true;

    try {
      // The server sets the price and seller and reserves the listing.
      const { error } = await supabase.rpc('buy_listing', { p_listing_id: listing.id });
      if (error) {
        console.error('Transaction error:', error);
        alert(error.message || 'Could not start the purchase. Please try again.');
        return;
      }
      fetchListings();
      openConversation(listing);
    } finally {
      busy.current = false;
    }
  };

  const handleMakeOffer = async (listing) => {
    if (!session) {
      onLogin();
      return;
    }
    if (busy.current) return;

    const input = prompt(`Make an offer for ${listing.title} (Current price: $${listing.price})`, listing.price);
    if (input === null) return;

    // Plain dollars and optional cents only, so "1e3" or "0x10" can't sneak in.
    const text = input.trim().replace(/^\$/, '');
    const amount = Number(text);
    if (!/^\d+(\.\d{1,2})?$/.test(text) || amount <= 0) {
      alert('Please enter a dollar amount, like 25 or 25.50.');
      return;
    }
    if (amount > Number(listing.price)) {
      alert(`Your offer can't be more than the asking price of $${listing.price}.`);
      return;
    }

    busy.current = true;
    try {
      const { error } = await supabase.from('offers').insert({
        listing_id: listing.id,
        buyer_id: session.user.id,
        seller_id: listing.seller_id,
        offer_amount: amount,
        status: 'pending',
      });

      if (error) throw error;

      alert(`Offer of $${amount.toFixed(2)} sent to seller!`);
      openConversation(listing);
    } catch (err) {
      console.error('Offer error:', err);
      alert('Failed to send offer. Please try again.');
    } finally {
      busy.current = false;
    }
  };

  return (
    <div className="dashboard">
      <header className="header">
        <h1>
          <button className="brand" onClick={() => goTo('browse')}>
            ReWear
          </button>
        </h1>
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
                  onBuyNow={handleBuyNow}
                  onMakeOffer={handleMakeOffer}
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

            <div className="seller-transactions">
              <h3>Your Sales</h3>
              <TransactionList userId={userId} role="seller" />
            </div>

            <div className="seller-transactions">
              <h3>Your Purchases</h3>
              <TransactionList userId={userId} role="buyer" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
