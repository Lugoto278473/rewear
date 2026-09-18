// A stand-in for the Supabase client used when no credentials are configured,
// so the app is explorable without a backend. It implements only the slice of
// the API this codebase actually calls, backed by localStorage.
//
// Deliberately not a general Supabase emulator — if you add a query shape the
// real client supports and this doesn't, it will throw rather than quietly
// return the wrong rows.

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
};

function load() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Private mode or corrupt payload — fall through to a fresh seed.
  }
  return { ...SEED, session: null, credentials: {} };
}

function save(db) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // Storage unavailable; the in-memory copy still works for this session.
  }
}

const delay = () => new Promise((r) => setTimeout(r, 180));
const ok = (data) => ({ data, error: null });
const fail = (message) => ({ data: null, error: new Error(message) });

export function createMockClient() {
  let db = load();
  const listeners = new Set();

  const persist = () => save(db);

  const emit = () => {
    listeners.forEach((cb) => cb('MOCK', db.session));
  };

  const publicUser = (id) => {
    const u = db.users.find((x) => x.id === id);
    return u ? { username: u.username, rating: u.rating } : null;
  };

  // Minimal query builder. Awaiting it runs the accumulated filters.
  function from(table) {
    const filters = [];
    let order = null;
    let embedUsers = false;
    let mode = 'many';

    const run = async () => {
      await delay();

      if (!db[table]) return fail(`relation "${table}" does not exist`);

      let rows = db[table].filter((row) =>
        filters.every(([col, val]) => row[col] === val)
      );

      if (order) {
        const [col, asc] = order;
        rows = [...rows].sort((a, b) =>
          asc
            ? String(a[col]).localeCompare(String(b[col]))
            : String(b[col]).localeCompare(String(a[col]))
        );
      }

      if (embedUsers) {
        rows = rows.map((r) => ({ ...r, users: publicUser(r.seller_id) }));
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
        return builder;
      },
      eq(column, value) {
        filters.push([column, value]);
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
      async insert(row) {
        await delay();
        const record = {
          ...row,
          id: row.id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          created_at: new Date().toISOString(),
        };
        db[table] = [...db[table], record];
        persist();
        return ok([record]);
      },
      then(resolve, reject) {
        return run().then(resolve, reject);
      },
    };

    return builder;
  }

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
      const username =
        options?.data?.username?.trim() || email.split('@')[0];

      // Mirrors the on_auth_user_created trigger: the profile row is created
      // server-side, not by the caller.
      db.users = [...db.users, { id, email, username, rating: null, bio: null }];
      db.credentials = { ...db.credentials, [email]: password };
      // No email confirmation step in demo mode, so sign in immediately.
      db.session = { user: { id, email } };
      persist();
      emit();

      return ok({ user: { id, email } });
    },

    async signInWithPassword({ email, password }) {
      await delay();

      const user = db.users.find((u) => u.email === email);
      const expected = db.credentials[email];

      // Seeded accounts have no password on file; accept any non-empty one so
      // the demo data is reachable.
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
  };

  return { auth, from };
}
