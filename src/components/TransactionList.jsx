import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/TransactionList.css';

// Who may take each step is enforced by advance_transaction() on the server;
// these just decide which buttons to show.
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
  pending: 'Waiting for seller',
  accepted: 'Accepted, not shipped yet',
  shipped: 'Shipped',
};

export default function TransactionList({ userId, role }) {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  const fetchTxs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, listings(title, price)')
        .eq(role === 'buyer' ? 'buyer_id' : 'seller_id', userId)
        .not('status', 'in', '(completed,declined)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTxs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId, role]);

  useEffect(() => {
    fetchTxs();
  }, [fetchTxs]);

  const updateStatus = async (id, newStatus) => {
    setUpdating(id);
    // supabase-js returns errors instead of throwing, so check explicitly.
    const { error } = await supabase.rpc('advance_transaction', {
      p_id: id,
      p_status: newStatus,
    });
    if (error) {
      console.error(error);
      alert(error.message || 'Error updating transaction');
    }
    await fetchTxs();
    setUpdating(null);
  };

  if (loading) return <p>Loading...</p>;
  if (txs.length === 0) {
    return <p>{role === 'buyer' ? 'No open purchases.' : 'No pending sales.'}</p>;
  }

  return (
    <div className="tx-list">
      {txs.map((tx) => (
        <div key={tx.id} className="tx-item">
          <div className="tx-info">
            <strong>{tx.listings?.title}</strong>
            <span>${tx.amount} — {STATUS_LABELS[tx.status] || tx.status}</span>
          </div>
          <div className="tx-actions">
            {(ACTIONS[role]?.[tx.status] || []).map((action) => (
              <button
                key={action.status}
                disabled={updating === tx.id}
                onClick={() => updateStatus(tx.id, action.status)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
