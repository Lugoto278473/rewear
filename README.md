# ReWear

Buy & sell secondhand. Any age. Fresh finds.

A React + Supabase marketplace: email/password auth, browse active listings, post
your own items, and a basic profile view.

## Running it now (no setup)

```
npm install
npm start
```

With no credentials configured the app runs in **demo mode**: a stand-in client
(`src/mockClient.js`) serves seeded listings from `localStorage`, so you can
browse, sign up, and post immediately. A banner marks it, and nothing leaves the
browser. Add real credentials (below) and the app switches to Supabase
automatically — no code change.

## Setup (going live on Supabase)

1. **Create the database.** In your Supabase project, open the SQL editor and run
   [`supabase/schema.sql`](supabase/schema.sql). It creates the `users` and
   `listings` tables plus row-level security policies.

2. **Add your credentials.** Copy `.env.example` to `.env` and fill in the values
   from Supabase → Project Settings → API:

   ```
   REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co
   REACT_APP_SUPABASE_KEY=your-anon-public-key
   ```

   Use the **anon public** key, not the service role key. `.env` is gitignored.
   Restart the dev server after changing it — CRA only reads env vars at startup.

3. **Restart the dev server.** CRA only reads env vars at boot, so hot reload
   won't pick them up. The demo banner disappears once it's connected.

## Scripts

| Command         | What it does                              |
| --------------- | ----------------------------------------- |
| `npm start`     | Dev server with hot reload                |
| `npm test`      | Test runner in watch mode                 |
| `npm run build` | Optimized production build to `build/`    |

## Structure

```
src/
  index.js              entry point, renders <App>
  index.css             design tokens (colors, radii, shadows) + base styles
  supabaseClient.js     real client, or the mock when unconfigured
  mockClient.js         localStorage stand-in used in demo mode
  components/
    App.jsx             session state; routes to Auth or Dashboard
    SetupNotice.jsx     instructions for connecting Supabase
    Auth.jsx            sign in / sign up
    Dashboard.jsx       shell with Browse / Post / Profile views
    ListingCard.jsx     single listing tile
    PostListing.jsx     new listing form
  styles/               one stylesheet per component
supabase/schema.sql     tables, indexes, RLS policies
```

Theming lives in the `:root` block of `src/index.css` — change `--accent` there
and the whole app follows.

## Notes

- Profile rows are created server-side by the `on_auth_user_created` trigger in
  `supabase/schema.sql`, which reads the username from the sign-up metadata. The
  client never inserts into `users` — at sign-up there's no session yet, so RLS
  would reject it.
- Sign-up requires email confirmation by default. Turn that off in Supabase →
  Authentication → Providers → Email if you want instant logins while developing.
- After `schema.sql`, also run `supabase/002_photos_and_messages.sql`. It adds
  the `listing-images` storage bucket and the `messages` table.
- Photos (up to 4) are resized to JPEG in the browser, then uploaded.
- "Inquire" opens a thread in the Messages tab. New messages are polled every
  15s; there's no realtime yet.
