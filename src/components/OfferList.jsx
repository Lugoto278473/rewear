import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/OfferList.css';

export default function OfferList({ userId, role, onOfferAccepted }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const fetchOffers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('offers')
        .select('*, listings(id, title, price, images), users!buyer_id(username)')
        .eq(role === 'seller' ? 'seller_id' : 'buyer_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOffers(data || []);
    } catch (err) {
      console.error('Error fetching offers:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, role]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const explain = (err) =>
    /could not find the function|does not exist/i.test(err.message)
      ? 'Offers are not enabled on the server yet. Run supabase/007_offers_and_messages_cleanup.sql in the Supabase SQL editor.'
      : err.message;

  const handleAccept = async (offer) => {
    setBusyId(offer.id);
    try {
      const { error } = await supabase.rpc('accept_offer', { p_offer_id: offer.id });
      if (error) throw error;
      alert(`Accepted offer of $${Number(offer.offer_amount).toFixed(2)}! It has moved to Your Sales.`);
      await fetchOffers();
      if (onOfferAccepted) onOfferAccepted();
    } catch (err) {
      console.error(err);
      alert('Could not accept offer: ' + explain(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (offer) => {
    if (!window.confirm('Decline this offer?')) return;
    setBusyId(offer.id);
    try {
      const { error } = await supabase.rpc('decline_offer', { p_offer_id: offer.id });
      if (error) throw error;
      await fetchOffers();
    } catch (err) {
      console.error(err);
      alert('Could not decline offer: ' + explain(err));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="offers-loading">Loading offers...</p>;
  if (offers.length === 0) {
    return <p className="offers-empty">{role === 'seller' ? 'No offers received yet.' : 'You haven’t made any offers yet.'}</p>;
  }

  return (
    <div className="offers-list">
      {offers.map((offer) => {
        const isPending = offer.status === 'pending';
        return (
          <div key={offer.id} className={`offer-item status-${offer.status}`}>
            <div className="offer-info">
              <strong className="offer-listing-title">{offer.listings?.title || 'Listing'}</strong>
              <div className="offer-amount-row">
                <span>
                  Offered: <strong>${Number(offer.offer_amount).toFixed(2)}</strong>{' '}
                  <span className="offer-asking">(Asking: ${offer.listings?.price})</span>
                </span>
                {role === 'seller' && (
                  <span className="offer-buyer">by @{offer.users?.username || 'buyer'}</span>
                )}
              </div>
              <span className={`offer-status-badge ${offer.status}`}>
                {offer.status === 'pending'
                  ? 'Waiting for seller'
                  : offer.status === 'accepted'
                  ? 'Accepted'
                  : 'Declined'}
              </span>
            </div>

            {role === 'seller' && isPending && (
              <div className="offer-actions">
                <button
                  className="accept-offer-btn"
                  disabled={busyId === offer.id}
                  onClick={() => handleAccept(offer)}
                >
                  {busyId === offer.id ? 'Accepting...' : 'Accept Offer'}
                </button>
                <button
                  className="decline-offer-btn"
                  disabled={busyId === offer.id}
                  onClick={() => handleDecline(offer)}
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
