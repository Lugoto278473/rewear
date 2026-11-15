# ReWear

**Buy & sell secondhand. Any age. Fresh finds.**

**Live demo:** https://rewear-cupm.vercel.app

ReWear is a secondhand clothing marketplace built with React and Supabase. Users can sign up, list items with photos and videos, browse what others are selling, message sellers, and buy through a "Safe Trade" escrow flow that tracks every sale from offer to delivery.

## Key Features

- **0% Seller Commission:** Sellers keep 100% of their sale price (no 10% or 20% platform cut).
- **Safe Trade Escrow Protection:** 
  - Each sale moves through `pending → accepted → shipped → completed`.
  - Transparent buyer fee (4% + $0.50) that covers platform maintenance, escrow protection, and card processing.
  - Only the seller can accept and ship; only the buyer can confirm delivery upon receipt.
- **Postal Tracking with Live USPS Link:**
  - Sellers enter their carrier tracking number when marking an order as shipped.
  - Buyers can track their incoming package on USPS with a single click.
- **Verified Reviews:**
  - Rating (1–5 stars) and feedback are purchase-gated — unlocked strictly after delivery is confirmed.
  - A database trigger recalculates the seller's verified rating average (`★ 4.9`) on the fly.
- **Media Presentation (Photos & Video):**
  - Up to 4 photos resized to JPEG in the browser.
  - Up to 60-second video clips for showing off garments.
  - TikTok-style fullscreen swipe Feed mixing photo and video listings.
- **Search & Category Filters:**
  - Quick chips for Vintage & Tees, Workwear & Jackets, Denim & Jeans, Kicks & Shoes, Jerseys & Sports, Caps & Gear.
  - Live search by title, seller, brand, or description.
- **Security & RLS:**
  - Email/password authentication with password recovery.
  - Row-Level Security on all tables and storage buckets.
  - Server-side functions and triggers prevent client tampering.
- **Demo Mode:**
  - Full local fallback client (`src/mockClient.js`) that persists in `localStorage` when run without backend credentials.

## Tech Stack

| Layer      | Technology                                              |
| ---------- | ------------------------------------------------------- |
| Frontend   | React 19 (Create React App), plain CSS with design tokens |
| Backend    | Supabase (Postgres, Auth, Storage, Edge Functions)      |
| Security   | Row-Level Security (RLS), Postgres Functions & Triggers |
| Hosting    | Vercel, with Vercel Web Analytics                       |

## Running Locally

```bash
npm install
npm start
```

Runs at `http://localhost:3000`. With no credentials configured, the app runs in **demo mode**: `src/mockClient.js` serves seeded listings from `localStorage`.

### Connecting to Supabase

In the Supabase SQL editor, run the migrations in order:
1. `supabase/schema.sql` (Users and listings)
2. `supabase/002_photos_and_messages.sql` (Storage bucket & messaging)
3. `setup_transactions.sql` (Safe Trade escrow functions & offers)
4. `supabase/004_lock_down_profiles_and_listings.sql` (Security lockdown)
5. `supabase/005_listing_videos.sql` (Video upload storage bucket)
6. `supabase/006_verified_reviews.sql` (Verified reviews & rating trigger)
7. `supabase/007_offers_and_messages_cleanup.sql` (Offer accept/decline & chat deletion)
8. `supabase/008_messages_realtime.sql` (Instant message delivery)

Add your credentials to `.env`:
```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_KEY=your-anon-public-key
```

## Running Unit Tests

```bash
npm test -- --watchAll=false
```

Tests cover:
- Demo mode fallback
- Safe Trade fee calculations (4% + $0.50)
- Listing joins and ordering
- Sign-up and profile creation
- Private messaging isolation & spoof prevention
- Safe Trade lifecycle with postal tracking
- Verified Reviews submission and rating updates
- Deleting listings
