import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import ListingCard from './ListingCard';
import PostListing from './PostListing';
import Messages from './Messages';
import TransactionList from './TransactionList';
import { DEFAULT_LOCATION, round2 } from '../location';
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
  const [viewerLocation, setViewerLocation] = useState(DEFAULT_LOCATION);

  // Use the browser's location only if already granted; browsing shouldn't
  // trigger a permission prompt. Otherwise distances are from the launch area.
  useEffect(() => {
    if (!navigator.geolocation || !navigator.permissions) return;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then(({ state }) => {
        if (state !== 'granted') return;
        navigator.geolocation.getCurrentPosition(
          ({ coords }) =>
            setViewerLocation({ lat: round2(coords.latitude), lng: round2(coords.longitude) }),
          () => {},
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
        );
      })
      .catch(() => {});
  }, []);

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

  // Unread messages: the browser remembers the newest message you've seen
  // (by server timestamp, so clock skew doesn't matter) and counts newer ones.
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return;
    }
    const seenKey = `rewear:messagesSeen:${userId}`;

    const check = async () => {
      if (view === 'messages') {
        const { data, error } = await supabase
          .from('messages')
          .select('created_at')
          .eq('recipient_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!error && data[0]) localStorage.setItem(seenKey, data[0].created_at);
        setUnread(0);
        return;
      }
      let query = supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId);
      const seen = localStorage.getItem(seenKey);
      if (seen) query = query.gt('created_at', seen);
      const { count, error } = await query;
      if (!error) setUnread(count ?? 0);
    };

    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [userId, view]);

  // Profile badge. Sales waiting on you (as seller: accept or ship; as
  // buyer: confirm delivery) drop as soon as you act. Sales a buyer has
  // confirmed delivered count until you next open your profile, tracked like
  // unread messages.
  const [toDo, setToDo] = useState(0);

  useEffect(() => {
    if (!userId) {
      setToDo(0);
      return;
    }
    const seenKey = `rewear:deliveriesSeen:${userId}`;

    const check = async () => {
      const waiting = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .or(
          `and(seller_id.eq.${userId},status.in.(pending,accepted)),` +
            `and(buyer_id.eq.${userId},status.eq.shipped)`
        );

      let delivered = 0;
      if (view === 'profile') {
        const { data, error } = await supabase
          .from('transactions')
          .select('updated_at')
          .eq('seller_id', userId)
          .eq('status', 'completed')
          .order('updated_at', { ascending: false })
          .limit(1);
        if (!error && data[0]) localStorage.setItem(seenKey, data[0].updated_at);
      } else {
        let query = supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', userId)
          .eq('status', 'completed');
        const seen = localStorage.getItem(seenKey);
        if (seen) query = query.gt('updated_at', seen);
        const { count, error } = await query;
        if (!error) delivered = count ?? 0;
      }

      if (!waiting.error) setToDo((waiting.count ?? 0) + delivered);
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [userId, view]);

  useEffect(() => {
    const total = unread + toDo;
    document.title = total > 0 ? `(${total}) ReWear` : 'ReWear';
  }, [unread, toDo]);

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
            {unread > 0 && (
              <span className="unread-badge" aria-label={`${unread} unread`}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {session ? (
            <>
              <button
                className={view === 'profile' ? 'active' : ''}
                onClick={() => goTo('profile')}
              >
                Profile
                {toDo > 0 && (
                  <span className="unread-badge" aria-label={`${toDo} sale updates`}>
                    {toDo > 9 ? '9+' : toDo}
                  </span>
                )}
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
                  viewerLocation={viewerLocation}
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
