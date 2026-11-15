import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import ListingCard from './ListingCard';
import PostListing from './PostListing';
import Messages from './Messages';
import TransactionList from './TransactionList';
import Feed from './Feed';
import { DEFAULT_LOCATION, round2 } from '../location';
import { calculateBuyerFee, calculateBuyerTotal } from '../fees';
import '../styles/Dashboard.css';

// The browse grid always shows at least this many spots.
const MIN_SPOTS = 8;

export default function Dashboard({ session, onLogin }) {
  const [listings, setListings] = useState([]);
  const [view, setView] = useState('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  // A conversation to open in Messages, started from a listing's Inquire.
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userReviews, setUserReviews] = useState([]);
  const [viewerLocation, setViewerLocation] = useState(DEFAULT_LOCATION);

  // Safe Trade Checkout & Offer Modals
  const [checkoutListing, setCheckoutListing] = useState(null);
  const [offerListing, setOfferListing] = useState(null);
  const [offerAmountInput, setOfferAmountInput] = useState('');

  const CATEGORIES = [
    { id: 'all', label: '🔥 All Finds' },
    { id: 'clothing', label: '👕 Vintage & Tees' },
    { id: 'jackets', label: '🧥 Workwear & Jackets' },
    { id: 'denim', label: '👖 Denim & Jeans' },
    { id: 'shoes', label: '👟 Kicks & Shoes' },
    { id: 'sports', label: '⚽ Jerseys & Sports' },
    { id: 'accessories', label: '🧢 Caps & Gear' },
  ];

  // Geolocation
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

  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      const cat = activeCategory.toLowerCase();
      const itemTitle = (item.title || '').toLowerCase();
      const itemDesc = (item.description || '').toLowerCase();
      const itemCat = (item.category || '').toLowerCase();
      const itemCond = (item.condition || '').toLowerCase();
      const itemSeller = (item.users?.username || '').toLowerCase();

      let matchesCat = true;
      if (cat !== 'all') {
        if (cat === 'jackets') {
          matchesCat =
            itemCat.includes('jacket') ||
            itemCat.includes('outerwear') ||
            itemTitle.includes('jacket') ||
            itemTitle.includes('coat') ||
            itemTitle.includes('hoodie');
        } else if (cat === 'denim') {
          matchesCat =
            itemCat.includes('denim') ||
            itemCat.includes('pant') ||
            itemTitle.includes('jean') ||
            itemTitle.includes('denim') ||
            itemTitle.includes('pant');
        } else if (cat === 'shoes') {
          matchesCat =
            itemCat.includes('shoe') ||
            itemTitle.includes('shoe') ||
            itemTitle.includes('sneaker') ||
            itemTitle.includes('kick');
        } else if (cat === 'sports') {
          matchesCat =
            itemCat.includes('sport') ||
            itemTitle.includes('jersey') ||
            itemDesc.includes('jersey');
        } else if (cat === 'clothing') {
          matchesCat =
            itemCat === 'clothing' ||
            itemTitle.includes('shirt') ||
            itemTitle.includes('tee') ||
            itemTitle.includes('top');
        } else {
          matchesCat = itemCat === cat || itemTitle.includes(cat);
        }
      }

      let matchesSearch = true;
      if (q) {
        matchesSearch =
          itemTitle.includes(q) ||
          itemDesc.includes(q) ||
          itemCat.includes(q) ||
          itemCond.includes(q) ||
          itemSeller.includes(q);
      }

      return matchesCat && matchesSearch;
    });
  }, [listings, activeCategory, searchQuery]);

  const userId = session?.user.id;

  const fetchUser = useCallback(async () => {
    if (!userId) {
      setUser(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, bio, rating')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUser(data);
    } catch (err) {
      console.error(err);
    }
  }, [userId]);

  const fetchUserReviews = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) setUserReviews(data);
    } catch (err) {
      console.error('Error fetching seller reviews:', err);
    }
  }, [userId]);

  useEffect(() => {
    fetchListings();
    fetchUser();
  }, [fetchListings, fetchUser]);

  useEffect(() => {
    if (view === 'profile') {
      fetchUserReviews();
    }
  }, [view, fetchUserReviews]);

  // Unread messages counter
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

  // Profile action badge
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

  const goTo = (next) => {
    if (next !== 'browse' && next !== 'feed' && !session) {
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

  const busy = useRef(false);

  // Trigger Checkout Modal
  const handleBuyNow = (listing) => {
    if (!session) {
      onLogin();
      return;
    }
    setCheckoutListing(listing);
  };

  // Execute Confirmed Purchase
  const executeBuyNow = async () => {
    if (!checkoutListing || busy.current) return;
    busy.current = true;

    try {
      const { error } = await supabase.rpc('buy_listing', { p_listing_id: checkoutListing.id });
      if (error) {
        console.error('Transaction error:', error);
        alert(error.message || 'Could not start the purchase. Please try again.');
        return;
      }
      const targetListing = checkoutListing;
      setCheckoutListing(null);
      fetchListings();
      openConversation(targetListing);
    } finally {
      busy.current = false;
    }
  };

  // Trigger Offer Modal
  const handleMakeOffer = (listing) => {
    if (!session) {
      onLogin();
      return;
    }
    setOfferListing(listing);
    setOfferAmountInput(listing.price);
  };

  // Execute Offer Submission
  const executeSubmitOffer = async (e) => {
    e.preventDefault();
    if (!offerListing || busy.current) return;

    const text = String(offerAmountInput).trim().replace(/^\$/, '');
    const amount = Number(text);
    if (!/^\d+(\.\d{1,2})?$/.test(text) || amount <= 0) {
      alert('Please enter a valid dollar amount (e.g. 25 or 25.50).');
      return;
    }
    if (amount > Number(offerListing.price)) {
      alert(`Your offer can't be more than the asking price of $${offerListing.price}.`);
      return;
    }

    busy.current = true;
    try {
      const { error } = await supabase.from('offers').insert({
        listing_id: offerListing.id,
        buyer_id: session.user.id,
        seller_id: offerListing.seller_id,
        offer_amount: amount,
        status: 'pending',
      });

      if (error) throw error;

      alert(`Offer of $${amount.toFixed(2)} sent! The seller will review it.`);
      setOfferListing(null);
    } catch (err) {
      console.error(err);
      alert('Could not send offer: ' + err.message);
    } finally {
      busy.current = false;
    }
  };

  const handleDeleteListing = async (listingId) => {
    if (!window.confirm('Are you sure you want to permanently delete this listing?')) return;
    try {
      const { error } = await supabase.from('listings').delete().eq('id', listingId);
      if (error) throw error;
      setListings((prev) => prev.filter((item) => item.id !== listingId));
    } catch (err) {
      console.error(err);
      alert('Could not delete listing: ' + err.message);
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
            className={view === 'feed' ? 'active' : ''}
            onClick={() => goTo('feed')}
          >
            Feed
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
              Sign In
            </button>
          )}
        </div>
      </header>

      <main className="content">
        {view === 'browse' && (
          <div className="browse-section">
            <h2>Browse Items</h2>
            <input
              type="search"
              className="browse-search"
              placeholder="Search items, sellers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="category-chips">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className={activeCategory === c.id ? 'active' : ''}
                  onClick={() => setActiveCategory(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {!loading && listings.length === 0 && (
              <p>No items yet. Be the first to post!</p>
            )}
            {!loading && listings.length > 0 && filteredListings.length === 0 && (
              <p>No items match your search.</p>
            )}
            <div className="listings-grid">
              {filteredListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isOwn={listing.seller_id === userId}
                  viewerLocation={viewerLocation}
                  onBuyNow={handleBuyNow}
                  onMakeOffer={handleMakeOffer}
                  onDelete={handleDeleteListing}
                />
              ))}
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

        {view === 'feed' && (
          <Feed
            listings={filteredListings}
            userId={userId}
            onBuyNow={handleBuyNow}
            onMakeOffer={handleMakeOffer}
            onMessage={(listing) => (session ? openConversation(listing) : onLogin())}
          />
        )}

        {view === 'post' && session && <PostListing onListingCreated={fetchListings} />}

        {view === 'messages' && session && <Messages session={session} draft={draft} />}

        {view === 'profile' && session && user && (
          <div className="profile-section">
            <div className="profile-header-info">
              <h2>@{user.username}</h2>
              <p>Email: {session.user.email}</p>
              <div className="profile-rating-badge">
                <span>
                  Rating: <strong>{user.rating ? `⭐ ${user.rating} / 5` : '⭐ New Seller (No ratings yet)'}</strong>
                </span>
                {userReviews.length > 0 && (
                  <span className="profile-sales-count">({userReviews.length} verified review{userReviews.length > 1 ? 's' : ''})</span>
                )}
              </div>
              {user.bio && <p className="profile-bio">{user.bio}</p>}
            </div>

            {/* Verified Reviews Section */}
            <div className="seller-transactions">
              <h3>⭐ Verified Reviews Received</h3>
              {userReviews.length === 0 ? (
                <p className="tx-empty">No reviews yet. Complete sales to earn verified ratings!</p>
              ) : (
                <div className="profile-reviews-list">
                  {userReviews.map((rev) => (
                    <div key={rev.id} className="profile-review-card">
                      <div className="review-meta">
                        <span className="review-stars">
                          {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                        </span>
                        <span className="review-date">
                          {new Date(rev.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {rev.comment ? (
                        <p className="review-body">"{rev.comment}"</p>
                      ) : (
                        <p className="review-body empty">Verified 5-star purchase</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sales & Purchases */}
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

      {/* MODAL: Safe Trade Checkout Confirmation */}
      {checkoutListing && (
        <div className="modal-backdrop" onClick={() => setCheckoutListing(null)}>
          <div className="modal-card checkout-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Safe Trade Checkout</h3>
            <p>
              You are purchasing <strong>{checkoutListing.title}</strong> from{' '}
              <strong>@{checkoutListing.users?.username || 'seller'}</strong>.
            </p>

            <div className="checkout-receipt">
              <div className="receipt-row">
                <span>Item Price</span>
                <span>${Number(checkoutListing.price).toFixed(2)}</span>
              </div>
              <div className="receipt-row">
                <span>Safe Trade Protection (4% + $0.50)</span>
                <span>${calculateBuyerFee(checkoutListing.price).toFixed(2)}</span>
              </div>
              <div className="receipt-divider" />
              <div className="receipt-row total">
                <strong>Total Payment</strong>
                <strong>${calculateBuyerTotal(checkoutListing.price).toFixed(2)}</strong>
              </div>
            </div>

            <div className="escrow-badge">
              <span>🛡️ <strong>Escrow Protected:</strong> ReWear holds the funds safely. The seller only receives payout after you confirm delivery.</span>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setCheckoutListing(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-btn"
                onClick={executeBuyNow}
              >
                Confirm & Reserve Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Make Offer */}
      {offerListing && (
        <div className="modal-backdrop" onClick={() => setOfferListing(null)}>
          <div className="modal-card offer-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Make an Offer</h3>
            <p>
              Propose a price for <strong>{offerListing.title}</strong> (Asking: ${offerListing.price}):
            </p>

            <form onSubmit={executeSubmitOffer}>
              <div className="offer-input-box">
                <span className="currency-symbol">$</span>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max={offerListing.price}
                  placeholder="Offer amount"
                  value={offerAmountInput}
                  onChange={(e) => setOfferAmountInput(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {Number(offerAmountInput) > 0 && (
                <div className="checkout-receipt">
                  <div className="receipt-row">
                    <span>Offered Price</span>
                    <span>${Number(offerAmountInput).toFixed(2)}</span>
                  </div>
                  <div className="receipt-row">
                    <span>Safe Trade Protection</span>
                    <span>${calculateBuyerFee(offerAmountInput).toFixed(2)}</span>
                  </div>
                  <div className="receipt-divider" />
                  <div className="receipt-row total">
                    <strong>Estimated Total</strong>
                    <strong>${calculateBuyerTotal(offerAmountInput).toFixed(2)}</strong>
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setOfferListing(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="confirm-btn"
                  disabled={!offerAmountInput || Number(offerAmountInput) <= 0}
                >
                  Send Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
