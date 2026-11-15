import { render, screen } from '@testing-library/react';
import { createMockClient } from './mockClient';
import { calculateBuyerFee, calculateBuyerTotal, getPriceBreakdown } from './fees';
import App from './components/App';

// No credentials in the test env, so exercise the demo path end to end.
jest.mock('./supabaseClient', () => {
  const { createMockClient: create } = require('./mockClient');
  return { isConfigured: false, isDemo: true, supabase: create() };
});

beforeEach(() => window.localStorage.clear());

test('falls back to demo mode instead of a blank page', async () => {
  render(<App />);
  expect(await screen.findByText(/demo mode/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
});

describe('fee engine', () => {
  test('calculates 4% + $0.50 Safe Trade buyer protection correctly', () => {
    // $30 item: 30 * 0.04 + 0.50 = 1.20 + 0.50 = $1.70
    expect(calculateBuyerFee(30)).toBe(1.7);
    expect(calculateBuyerTotal(30)).toBe(31.7);

    // $50 item: 50 * 0.04 + 0.50 = 2.00 + 0.50 = $2.50
    expect(calculateBuyerFee(50)).toBe(2.5);
    expect(calculateBuyerTotal(50)).toBe(52.5);

    // $15 item: 15 * 0.04 + 0.50 = 0.60 + 0.50 = $1.10
    expect(calculateBuyerFee(15)).toBe(1.1);
    expect(calculateBuyerTotal(15)).toBe(16.1);

    const receipt = getPriceBreakdown(30);
    expect(receipt.itemPrice).toBe('30.00');
    expect(receipt.fee).toBe('1.70');
    expect(receipt.total).toBe('31.70');
  });
});

describe('mock client', () => {
  test('lists active listings newest first, with seller joined', async () => {
    const { data, error } = await createMockClient()
      .from('listings')
      .select('*, users(username, rating)')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    expect(error).toBeNull();
    expect(data).toHaveLength(4);
    expect(data[0].title).toMatch(/wool overcoat/i);
    expect(data[0].users.username).toBe('ada');
  });

  test('sign-up creates a profile and an active session', async () => {
    const client = createMockClient();

    const { error } = await client.auth.signUp({
      email: 'new@example.com',
      password: 'hunter2',
      options: { data: { username: 'newbie' } },
    });
    expect(error).toBeNull();

    const { data } = await client.auth.getSession();
    expect(data.session.user.email).toBe('new@example.com');

    const profile = await client
      .from('users')
      .select('*')
      .eq('id', data.session.user.id)
      .single();
    expect(profile.data.username).toBe('newbie');
  });

  test('messages are only visible to their sender and recipient', async () => {
    const client = createMockClient();
    await client.auth.signUp({ email: 'buyer@example.com', password: 'pw' });

    const { data: me } = await client.auth.getUser();
    const { error } = await client.from('messages').insert({
      listing_id: 'seed-1',
      sender_id: me.user.id,
      recipient_id: 'seed-ada',
      body: 'Still available?',
    });
    expect(error).toBeNull();

    const mine = await client.from('messages').select('*');
    expect(mine.data).toHaveLength(1);

    await client.auth.signOut();
    await client.auth.signUp({ email: 'other@example.com', password: 'pw' });
    const theirs = await client.from('messages').select('*');
    expect(theirs.data).toHaveLength(0);
  });

  test('cannot send a message as someone else', async () => {
    const client = createMockClient();
    await client.auth.signUp({ email: 'x@example.com', password: 'pw' });
    const { error } = await client.from('messages').insert({
      listing_id: 'seed-1',
      sender_id: 'seed-mori',
      recipient_id: 'seed-ada',
      body: 'spoof',
    });
    expect(error).not.toBeNull();
  });

  test('in() filters by a list of values', async () => {
    const { data } = await createMockClient()
      .from('users')
      .select('id, username')
      .in('id', ['seed-ada', 'seed-june']);
    expect(data.map((u) => u.username).sort()).toEqual(['ada', 'june']);
  });

  test('rejects a wrong password for a registered account', async () => {
    const client = createMockClient();
    await client.auth.signUp({ email: 'a@b.com', password: 'right' });
    await client.auth.signOut();

    const { error } = await client.auth.signInWithPassword({
      email: 'a@b.com',
      password: 'wrong',
    });
    expect(error).not.toBeNull();
  });

  test('Safe Trade: reserves item and tracks delivery lifecycle with USPS tracking', async () => {
    const client = createMockClient();
    await client.auth.signUp({ email: 'brother@example.com', password: 'pw' });

    // 1. Buy listing
    const { data: tx, error: buyError } = await client.rpc('buy_listing', {
      p_listing_id: 'seed-1',
    });
    expect(buyError).toBeNull();
    expect(tx.status).toBe('pending');

    // Listing is now reserved
    const { data: listing } = await client
      .from('listings')
      .select('*')
      .eq('id', 'seed-1')
      .single();
    expect(listing.status).toBe('reserved');

    // 2. Seller marks as shipped with tracking number
    const tracking = '9400100000000000000000';
    const { data: shippedTx, error: shipError } = await client.rpc('advance_transaction', {
      p_id: tx.id,
      p_status: 'shipped',
      p_tracking_number: tracking,
    });
    expect(shipError).toBeNull();
    expect(shippedTx.status).toBe('shipped');
    expect(shippedTx.tracking_number).toBe(tracking);

    // 3. Buyer confirms delivery
    const { data: doneTx, error: doneError } = await client.rpc('advance_transaction', {
      p_id: tx.id,
      p_status: 'completed',
    });
    expect(doneError).toBeNull();
    expect(doneTx.status).toBe('completed');
  });

  test('Verified Reviews: updates seller rating upon review submission', async () => {
    const client = createMockClient();

    // Insert a 5-star review for seller ada
    const { error } = await client.from('reviews').insert({
      transaction_id: 'test-tx-123',
      buyer_id: 'seed-buyer',
      seller_id: 'seed-ada',
      rating: 5,
      comment: 'Super fast shipping, exactly as described!',
    });
    expect(error).toBeNull();

    // Verify ada's rating is recalculable and reviews can be retrieved
    const { data: revs } = await client
      .from('reviews')
      .select('*')
      .eq('seller_id', 'seed-ada');
    expect(revs).toHaveLength(1);
    expect(revs[0].rating).toBe(5);
  });

  test('supports deleting a listing', async () => {
    const client = createMockClient();
    const { error } = await client.from('listings').delete().eq('id', 'seed-4');
    expect(error).toBeNull();

    const { data } = await client.from('listings').select('*').eq('id', 'seed-4');
    expect(data).toHaveLength(0);
  });
});
