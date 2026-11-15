import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { calculateBuyerFee, calculateBuyerTotal } from '../fees';
import '../styles/TransactionList.css';

const ACTIONS = {
  seller: {
    pending: [
      { status: 'accepted', label: 'Accept Sale' },
      { status: 'declined', label: 'Decline' },
    ],
    accepted: [{ status: 'shipped', label: 'Mark as Shipped' }],
  },
  buyer: {
    shipped: [{ status: 'completed', label: 'Confirm Delivery' }],
  },
};

const STATUS_LABELS = {
  pending: 'Waiting for seller to accept',
  accepted: 'Accepted — preparing shipment',
  shipped: 'Shipped — in transit',
};

const DONE_LABELS = {
  seller: 'Delivered: buyer confirmed',
  buyer: 'Delivered & verified',
};

export default function TransactionList({ userId, role }) {
  const [txs, setTxs] = useState([]);
  const [reviews, setReviews] = useState({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  // Tracking modal state
  const [shippingTxId, setShippingTxId] = useState(null);
  const [trackingInput, setTrackingInput] = useState('');

  // Review modal state
  const [reviewingTx, setReviewingTx] = useState(null);
  const [ratingInput, setRatingInput] = useState(5);
  const [commentInput, setCommentInput] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchTxsAndReviews = useCallback(async () => {
    try {
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*, listings(title, price, images)')
        .eq(role === 'buyer' ? 'buyer_id' : 'seller_id', userId)
        .neq('status', 'declined')
        .order('created_at', { ascending: false });

      if (txError) throw txError;
      setTxs(txData || []);

      // If buyer, fetch any reviews already written
      if (role === 'buyer' && txData && txData.length > 0) {
        const txIds = txData.map((t) => t.id);
        const { data: revData } = await supabase
          .from('reviews')
          .select('*')
          .in('transaction_id', txIds);

        if (revData) {
          const revMap = {};
          revData.forEach((r) => {
            revMap[r.transaction_id] = r;
          });
          setReviews(revMap);
        }
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, role]);

  useEffect(() => {
    fetchTxsAndReviews();
  }, [fetchTxsAndReviews]);

  const handleActionClick = (tx, action) => {
    if (action.status === 'shipped') {
      setShippingTxId(tx.id);
      setTrackingInput('');
    } else {
      updateStatus(tx.id, action.status);
    }
  };

  const confirmShipping = async (e) => {
    e.preventDefault();
    if (!shippingTxId) return;
    await updateStatus(shippingTxId, 'shipped', trackingInput.trim());
    setShippingTxId(null);
    setTrackingInput('');
  };

  const updateStatus = async (id, newStatus, trackingNumber = null) => {
    setUpdating(id);
    const rpcParams = {
      p_id: id,
      p_status: newStatus,
    };
    if (trackingNumber) {
      rpcParams.p_tracking_number = trackingNumber;
    }

    const { error } = await supabase.rpc('advance_transaction', rpcParams);

    if (error) {
      console.error(error);
      alert(error.message || 'Error updating transaction');
    }
    await fetchTxsAndReviews();
    setUpdating(null);
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!reviewingTx) return;

    setSubmittingReview(true);
    try {
      const { error } = await supabase.from('reviews').insert({
        transaction_id: reviewingTx.id,
        buyer_id: userId,
        seller_id: reviewingTx.seller_id,
        rating: ratingInput,
        comment: commentInput.trim(),
      });

      if (error) throw error;

      alert('Thank you! Your verified review has been posted.');
      setReviewingTx(null);
      setCommentInput('');
      setRatingInput(5);
      await fetchTxsAndReviews();
    } catch (err) {
      console.error('Review error:', err);
      alert('Could not submit review: ' + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <p className="tx-loading">Loading orders...</p>;
  if (txs.length === 0) {
    return (
      <p className="tx-empty">
        {role === 'buyer' ? 'No purchases yet.' : 'No sales yet.'}
      </p>
    );
  }

  return (
    <div className="tx-list">
      {txs.map((tx) => {
        const itemPrice = Number(tx.amount);
        const buyerFee = calculateBuyerFee(itemPrice);
        const buyerTotal = calculateBuyerTotal(itemPrice);
        const existingReview = reviews[tx.id];

        return (
          <div
            key={tx.id}
            className={`tx-item${tx.status === 'completed' ? ' tx-done' : ''}`}
          >
            <div className="tx-info">
              <strong className="tx-title">{tx.listings?.title || 'Secondhand Item'}</strong>

              <div className="tx-price-breakdown">
                {role === 'buyer' ? (
                  <span>
                    Item: <strong>${itemPrice.toFixed(2)}</strong> + Safe Trade Protection:{' '}
                    <strong>${buyerFee.toFixed(2)}</strong> (Total: ${buyerTotal.toFixed(2)})
                  </span>
                ) : (
                  <span>
                    Item Price: <strong>${itemPrice.toFixed(2)}</strong> (0% seller commission)
                  </span>
                )}
              </div>

              <span className="tx-status">
                Status:{' '}
                {tx.status === 'completed'
                  ? `${DONE_LABELS[role]} on ${new Date(tx.updated_at).toLocaleDateString()}`
                  : STATUS_LABELS[tx.status] || tx.status}
              </span>

              {tx.tracking_number && (
                <div className="tx-tracking">
                  <span>📦 Tracking: <strong>{tx.tracking_number}</strong></span>
                  <a
                    href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(
                      tx.tracking_number
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="usps-link"
                  >
                    Track on USPS ↗
                  </a>
                </div>
              )}

              {/* Show review status if completed */}
              {role === 'buyer' && tx.status === 'completed' && existingReview && (
                <div className="tx-reviewed-badge">
                  <span>
                    ⭐ Verified Review: {'★'.repeat(existingReview.rating)}
                    {'☆'.repeat(5 - existingReview.rating)}
                  </span>
                  {existingReview.comment && (
                    <q className="tx-reviewed-comment">"{existingReview.comment}"</q>
                  )}
                </div>
              )}
            </div>

            <div className="tx-actions">
              {(ACTIONS[role]?.[tx.status] || []).map((action) => (
                <button
                  key={action.status}
                  disabled={updating === tx.id}
                  onClick={() => handleActionClick(tx, action)}
                  className="tx-btn"
                >
                  {updating === tx.id ? 'Updating...' : action.label}
                </button>
              ))}

              {/* Buyer Verified Review Button */}
              {role === 'buyer' && tx.status === 'completed' && !existingReview && (
                <button
                  className="tx-btn review-btn"
                  onClick={() => setReviewingTx(tx)}
                >
                  ⭐ Rate Seller
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* MODAL: Tracking Number Entry (Seller) */}
      {shippingTxId && (
        <div className="modal-backdrop" onClick={() => setShippingTxId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Mark as Shipped</h3>
            <p>Enter the USPS or carrier tracking number from your postal receipt:</p>
            <form onSubmit={confirmShipping}>
              <input
                type="text"
                placeholder="e.g. 9400 1000 0000 0000 0000 00"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                required
                autoFocus
              />
              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShippingTxId(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="confirm-btn">
                  Confirm Shipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Verified Review (Buyer) */}
      {reviewingTx && (
        <div className="modal-backdrop" onClick={() => setReviewingTx(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Leave a Verified Review</h3>
            <p>
              Rate your purchase of <strong>{reviewingTx.listings?.title}</strong>:
            </p>
            <form onSubmit={submitReview}>
              <div className="star-rating-select">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`star-btn ${star <= ratingInput ? 'active' : ''}`}
                    onClick={() => setRatingInput(star)}
                    aria-label={`${star} star`}
                  >
                    ★
                  </button>
                ))}
                <span className="star-text">{ratingInput} / 5 Stars</span>
              </div>

              <textarea
                placeholder="How was the item condition, packaging, and delivery? (Optional)"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                maxLength={500}
                rows={3}
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setReviewingTx(null)}
                  disabled={submittingReview}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="confirm-btn"
                  disabled={submittingReview}
                >
                  {submittingReview ? 'Posting...' : 'Post Verified Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
