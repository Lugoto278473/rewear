import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/Messages.css';

// No realtime subscription yet; a slow poll picks up replies.
const POLL_MS = 15000;

const threadKey = (listingId, otherId) => `${listingId}:${otherId}`;
const lastAt = (thread) => thread.messages.at(-1)?.created_at ?? '';

const formatTime = (iso) =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default function Messages({ session, draft }) {
  const me = session.user.id;
  const [messages, setMessages] = useState([]);
  const [names, setNames] = useState({});
  const [titles, setTitles] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState(
    draft ? threadKey(draft.listingId, draft.otherId) : null
  );
  const [body, setBody] = useState(draft ? 'Hi! Is this still available?' : '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;

      const userIds = [...new Set(data.flatMap((m) => [m.sender_id, m.recipient_id]))];
      const listingIds = [...new Set(data.map((m) => m.listing_id))];
      const [users, listings] = await Promise.all([
        userIds.length
          ? supabase.from('users').select('id, username').in('id', userIds)
          : { data: [] },
        listingIds.length
          ? supabase.from('listings').select('id, title').in('id', listingIds)
          : { data: [] },
      ]);
      if (users.error) throw users.error;
      if (listings.error) throw listings.error;

      setMessages(data);
      setNames(Object.fromEntries(users.data.map((u) => [u.id, u.username])));
      setTitles(Object.fromEntries(listings.data.map((l) => [l.id, l.title])));
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const id = setInterval(fetchMessages, POLL_MS);
    return () => clearInterval(id);
  }, [fetchMessages]);

  // If the backend supports Realtime, refresh as soon as a message lands.
  // The poll above stays as a fallback (and covers demo mode).
  useEffect(() => {
    if (typeof supabase.channel !== 'function') return undefined;
    const channel = supabase
      .channel(`messages:${me}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => fetchMessages()
      )
      .subscribe();
    return () => {
      if (typeof supabase.removeChannel === 'function') supabase.removeChannel(channel);
    };
  }, [me, fetchMessages]);

  // Opening a conversation from a listing while Messages is already mounted
  // should switch to that thread instead of showing the previous one.
  useEffect(() => {
    if (!draft) return;
    setActiveKey(threadKey(draft.listingId, draft.otherId));
    setBody('Hi! Is this still available?');
  }, [draft]);

  const threads = useMemo(() => {
    const map = new Map();
    const ensure = (listingId, otherId) => {
      const key = threadKey(listingId, otherId);
      if (!map.has(key)) map.set(key, { key, listingId, otherId, messages: [] });
      return map.get(key);
    };
    for (const m of messages) {
      ensure(m.listing_id, m.sender_id === me ? m.recipient_id : m.sender_id).messages.push(m);
    }
    if (draft) ensure(draft.listingId, draft.otherId);
    return [...map.values()].sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
  }, [messages, me, draft]);

  const active = threads.find((t) => t.key === activeKey) ?? threads[0] ?? null;

  const titleOf = (listingId) =>
    titles[listingId] ??
    (draft?.listingId === listingId ? draft.listingTitle : 'Listing');
  const nameOf = (userId) =>
    names[userId] ?? (draft?.otherId === userId ? draft.otherName : 'someone');

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.key, active?.messages.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || !active) return;

    setSending(true);
    setError('');
    try {
      const { error } = await supabase.from('messages').insert({
        listing_id: active.listingId,
        sender_id: me,
        recipient_id: active.otherId,
        body: text,
      });
      if (error) throw error;
      setBody('');
      await fetchMessages();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  // Delete an individual message
  const handleDeleteMessage = async (messageId) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .select();
      if (error) throw error;
      if (!data?.length) {
        throw new Error('The server did not delete it. Run migration 007 in Supabase.');
      }
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error(err);
      alert('Could not delete message: ' + err.message);
      fetchMessages();
    }
  };

  // Delete entire conversation thread
  const handleDeleteThread = async (thread) => {
    if (!window.confirm(`Delete the entire conversation about "${titleOf(thread.listingId)}"?`)) return;
    try {
      const idsToDelete = thread.messages.map((m) => m.id);
      if (idsToDelete.length > 0) {
        const { data, error } = await supabase
          .from('messages')
          .delete()
          .in('id', idsToDelete)
          .select();
        if (error) throw error;
        if (!data?.length) {
          throw new Error('The server did not delete them. Run migration 007 in Supabase.');
        }
      }
      setMessages((prev) => prev.filter((m) => !idsToDelete.includes(m.id)));
      setActiveKey(null);
    } catch (err) {
      console.error(err);
      alert('Could not delete conversation: ' + err.message);
      fetchMessages();
    }
  };

  return (
    <div className="messages-section">
      <h2>Messages</h2>
      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="messages-empty">Loading...</p>
      ) : !active ? (
        <p className="messages-empty">
          No conversations yet. Hit <strong>Inquire</strong> on a listing to
          message the seller.
        </p>
      ) : (
        <div className="messages-layout">
          <ul className="thread-list">
            {threads.map((t) => (
              <li key={t.key}>
                <button
                  className={t.key === active.key ? 'active' : ''}
                  onClick={() => {
                    setActiveKey(t.key);
                    setError('');
                  }}
                >
                  <span className="thread-title">{titleOf(t.listingId)}</span>
                  <span className="thread-meta">{nameOf(t.otherId)}</span>
                  <span className="thread-snippet">
                    {t.messages.at(-1)?.body ?? 'New conversation'}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="thread">
            <div className="thread-header">
              <div className="thread-header-info">
                <strong>{titleOf(active.listingId)}</strong>
                <span>with {nameOf(active.otherId)}</span>
              </div>
              <button
                type="button"
                className="delete-chat-btn"
                onClick={() => handleDeleteThread(active)}
                title="Delete this entire conversation"
              >
                🗑️ Delete Chat
              </button>
            </div>

            <div className="thread-messages" ref={listRef}>
              {active.messages.length === 0 ? (
                <p className="thread-empty">
                  Say hi to {nameOf(active.otherId)}.
                </p>
              ) : (
                active.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`bubble ${m.sender_id === me ? 'mine' : 'theirs'}`}
                  >
                    <div className="bubble-content">
                      <p>{m.body}</p>
                      <button
                        type="button"
                        className="msg-delete-btn"
                        onClick={() => handleDeleteMessage(m.id)}
                        title="Delete message"
                      >
                        ×
                      </button>
                    </div>
                    <time dateTime={m.created_at}>{formatTime(m.created_at)}</time>
                  </div>
                ))
              )}
            </div>

            <form className="composer" onSubmit={handleSend}>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form.requestSubmit();
                  }
                }}
                placeholder="Write a message"
                rows={2}
                maxLength={2000}
                autoFocus={Boolean(draft)}
              />
              <button type="submit" disabled={sending || !body.trim()}>
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
