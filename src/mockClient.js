// A stand-in for the Supabase client used when no credentials are configured,
// so the app is explorable without a backend. It implements only the slice of
// the API this codebase actually calls, backed by localStorage.

const KEY = 'rewear.demo';

const SEED = {
  users: [
    { id: 'seed-ada', email: 'ada@example.com', username: 'ada', rating: 4.9, bio: 'Vintage denim, mostly.' },
    { id: 'seed-mori', email: 'mori@example.com', username: 'mori', rating: 4.6, bio: null },
    { id: 'seed-june', email: 'june@example.com', username: 'june', rating: null, bio: null },
  ],
  listings: [
    {
      id: 'seed-1',
      seller_id: 'seed-ada',
      title: 'Levi’s 501, mid-90s',
      description: 'True vintage, W32 L30. Faded exactly where you want it. No holes.',
      category: 'clothing',
      price: 68,
      condition: 'excellent',
      images: null,
      status: 'active',
      created_at: '2026-09-14T10:00:00.000Z',
    },
    {
      id: 'seed-2',
      seller_id: 'seed-mori',
      title: 'Braun SK4 record player',
      description: 'Dieter Rams, 1956. Fully serviced, new belt. Lid has one hairline crack.',
      category: 'electronics',
      price: 540,
      condition: 'good',
      images: null,
      status: 'active',
      created_at: '2026-09-15T09:30:00.000Z',
    },
    {
      id: 'seed-3',
      seller_id: 'seed-june',
      title: 'Teak dining chairs, set of 4',
      description: 'Danish, refinished last winter. Joints tight, cushions reupholstered.',
      category: 'furniture',
      price: 320,
      condition: 'like-new',
      images: null,
      status: 'active',
      created_at: '2026-09-16T14:15:00.000Z',
    },
    {
      id: 'seed-4',
      seller_id: 'seed-ada',
      title: 'Wool overcoat, charcoal',
      description: 'Heavy melton, size M. Small moth nick on the inner lining, not visible worn.',
      category: 'clothing',
      price: 95,
      condition: 'good',
      images: null,
      status: 'active',
      created_at: '2026-09-17T08:00:00.000Z',
    },
  ],
  messages: [],
  transactions: [],
  offers: [],
  reviews: [],
};

function load() {
  const fresh = { ...SEED, session: null, credentials: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...fresh, ...JSON.parse(raw) };
  } catch {
    // Private mode or corrupt payload
  }
  return fresh;
}

const toDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

function save(db) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // Storage unavailable
  }
}

const delay = () => new Promise((r) => setTimeout(r, 80));
const ok = (data) => ({ data, error: null });
const fail = (message) => ({ data: null, error: new Error(message) });

export function createMockClient() {
  let db = load();
  if (!db.transactions) db.transactions = [];
  if (!db.offers) db.offers = [];
  if (!db.reviews) db.reviews = [];

  const listeners = new Set();
  const persist = () => save(db);

  const emit = () => {
    listeners.forEach((cb) => cb('MOCK', db.session));
  };

  const publicUser = (id) => {
    const u = db.users.find((x) => x.id === id);
    return u ? { username: u.username, rating: u.rating, bio: u.bio } : null;
  };

  const recalculateSellerRating = (sellerId) => {
    const sellerReviews = db.reviews.filter((r) => r.seller_id === sellerId);
    if (!sellerReviews.length) return;
    const sum = sellerReviews.reduce((acc, r) => acc + Number(r.rating), 0);
    const avg = Math.round((sum / sellerReviews.length) * 10) / 10;
    const sellerIndex = db.users.findIndex((u) => u.id === sellerId);
    if (sellerIndex >= 0) {
      db.users[sellerIndex].rating = avg;
      persist();
    }
  };

  function from(table) {
    const filters = [];
    let order = null;
    let embedUsers = false;
    let embedListings = false;
    let mode = 'many'; // 'many' | 'single' | 'maybeSingle' | 'delete'

    const run = async () => {
      await delay();

      if (!db[table]) {
        db[table] = [];
      }

      let rows = db[table].filter((row) => filters.every((test) => test(row)));

      if (table === 'messages') {
        const me = db.session?.user.id;
        rows = rows.filter((m) => m.sender_id === me || m.recipient_id === me);
      }

      if (order) {
        const [col, asc] = order;
        rows = [...rows].sort((a, b) => {
          const valA = a[col] ?? '';
          const valB = b[col] ?? '';
          return asc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
        });
      }

      if (embedUsers) {
        rows = rows.map((r) => ({
          ...r,
          users: publicUser(r.seller_id || r.buyer_id || r.user_id),
        }));
      }

      if (embedListings) {
        rows = rows.map((r) => {
          const l = db.listings.find((x) => x.id === r.listing_id);
          return {
            ...r,
            listings: l ? { title: l.title, price: l.price, images: l.images } : null,
          };
        });
      }

      if (mode === 'delete') {
        const toDelete = new Set(rows.map((r) => r.id));
        db[table] = db[table].filter((r) => !toDelete.has(r.id));
        persist();
        return ok(rows);
      }

      if (mode === 'single') {
        if (rows.length !== 1) return fail('JSON object requested, multiple (or no) rows returned');
        return ok(rows[0]);
      }
      if (mode === 'maybeSingle') {
        return ok(rows[0] ?? null);
      }
      return ok(rows);
    };

    const builder = {
      select(columns = '*') {
        embedUsers = columns.includes('users(');
        embedListings = columns.includes('listings(');
        return builder;
      },
      eq(column, value) {
        filters.push((row) => row[column] === value);
        return builder;
      },
      neq(column, value) {
        filters.push((row) => row[column] !== value);
        return builder;
      },
      in(column, values) {
        filters.push((row) => values.includes(row[column]));
        return builder;
      },
      order(column, { ascending = true } = {}) {
        order = [column, ascending];
        return builder;
      },
      single() {
        mode = 'single';
        return builder;
      },
      maybeSingle() {
        mode = 'maybeSingle';
        return builder;
      },
      delete() {
        mode = 'delete';
        return builder;
      },
      async insert(row) {
        await delay();
        if (table === 'messages' && row.sender_id !== db.session?.user.id) {
          return fail('new row violates row-level security policy for table "messages"');
        }

        const rowsToInsert = Array.isArray(row) ? row : [row];
        const inserted = rowsToInsert.map((r) => ({
          ...r,
          id: r.id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          created_at: r.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        if (!db[table]) db[table] = [];
        db[table] = [...db[table], ...inserted];

        if (table === 'reviews') {
          inserted.forEach((rev) => {
            if (rev.seller_id) recalculateSellerRating(rev.seller_id);
          });
        }

        persist();
        return ok(inserted);
      },
      then(resolve, reject) {
        return run().then(resolve, reject);
      },
    };

    return builder;
  }

  // Database RPC function mock for buy_listing and advance_transaction
  const rpc = async (name, params = {}) => {
    await delay();
    if (name === 'buy_listing') {
      const { p_listing_id } = params;
      const listing = db.listings.find((l) => l.id === p_listing_id);
      if (!listing) return fail('Listing not found');
      if (listing.status !== 'active') return fail('This item is no longer available.');
      if (listing.seller_id === db.session?.user.id) return fail('You cannot buy your own listing.');

      listing.status = 'reserved';
      const tx = {
        id: `local-tx-${Date.now()}`,
        listing_id: listing.id,
        buyer_id: db.session?.user.id || 'seed-buyer',
        seller_id: listing.seller_id,
        amount: listing.price,
        status: 'pending',
        tracking_number: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.transactions.push(tx);
      persist();
      return ok(tx);
    }

    if (name === 'advance_transaction') {
      const { p_id, p_status, p_tracking_number } = params;
      const tx = db.transactions.find((t) => t.id === p_id);
      if (!tx) return fail('Transaction not found');

      tx.status = p_status;
      tx.updated_at = new Date().toISOString();
      if (p_tracking_number) {
        tx.tracking_number = p_tracking_number;
      }

      // If declined, make listing active again
      if (p_status === 'declined') {
        const listing = db.listings.find((l) => l.id === tx.listing_id);
        if (listing) listing.status = 'active';
      }

      persist();
      return ok(tx);
    }

    return fail(`Unknown RPC function: ${name}`);
  };

  const auth = {
    async getSession() {
      await delay();
      return ok({ session: db.session });
    },

    onAuthStateChange(callback) {
      listeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => listeners.delete(callback),
          },
        },
      };
    },

    async signUp({ email, password, options }) {
      await delay();

      if (db.users.some((u) => u.email === email)) {
        return { data: null, error: new Error('An account with that email already exists.') };
      }

      const id = `local-${Date.now()}`;
      const username = options?.data?.username?.trim() || email.split('@')[0];

      db.users = [...db.users, { id, email, username, rating: null, bio: null }];
      db.credentials = { ...db.credentials, [email]: password };
      db.session = { user: { id, email } };
      persist();
      emit();

      return ok({ user: { id, email } });
    },

    async signInWithPassword({ email, password }) {
      await delay();

      const user = db.users.find((u) => u.email === email);
      const expected = db.credentials[email];

      const seeded = user && expected === undefined;
      if (!user || (!seeded && expected !== password)) {
        return { data: null, error: new Error('Invalid login credentials') };
      }

      db.session = { user: { id: user.id, email: user.email } };
      persist();
      emit();
      return ok({ user: db.session.user });
    },

    async signOut() {
      await delay();
      db.session = null;
      persist();
      emit();
      return { error: null };
    },

    async getUser() {
      await delay();
      return ok({ user: db.session?.user ?? null });
    },

    async resetPasswordForEmail(email) {
      await delay();
      return ok({});
    },

    async updateUser({ password }) {
      await delay();
      if (!db.session?.user) return fail('Not authenticated');
      db.credentials[db.session.user.email] = password;
      persist();
      return ok({ user: db.session.user });
    },
  };

  const files = new Map();
  const storage = {
    from(bucket) {
      return {
        async upload(path, file) {
          await delay();
          files.set(`${bucket}/${path}`, await toDataUrl(file));
          return ok({ path });
        },
        getPublicUrl(path) {
          return { data: { publicUrl: files.get(`${bucket}/${path}`) ?? '' } };
        },
      };
    },
  };

  return { auth, from, rpc, storage };
}
