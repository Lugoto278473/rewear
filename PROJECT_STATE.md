# ReWear Project State - November 2026

## Overview
ReWear is a secondhand clothing marketplace built with React and Supabase, centered on an anti-scam "Safe Trade" escrow workflow, verified buyer reviews, and seller-friendly 0% commission pricing.

---

## Completed Features

### 1. Safe Trade (Escrow Protection & Tracking)
- **Zero Seller Commission (0%):** Sellers keep 100% of their item sale price, out-competing Poshmark (20%) and Mercari (10%).
- **Buyer Protection Fee (4% + $0.50):** Undercuts Depop (5% + $1.00) and Vinted (5% + $0.70). Covers escrow guarantee, support, and card processing.
- **Transparent Checkout Breakdown:** Shows Item Price + Safe Trade Protection = Total before reserving.
- **Postal Tracking & USPS Link:** When the seller marks an order as shipped, they enter the carrier tracking number. Both buyer and seller receive a direct one-click link to track the package on USPS.
- **State Enforcement:** 
  - `pending` -> `accepted` / `declined` (seller only)
  - `accepted` -> `shipped` (seller records tracking number)
  - `shipped` -> `completed` (buyer confirms delivery upon receipt)

### 2. Verified Reviews (Phase 2 Trust Completed)
- **Purchase-Gated Reviews:** Only verified buyers who completed a real transaction through Safe Trade (`status = 'completed'`) can rate and review a seller.
- **Anti-Spam / Review Stuffing Protection:** Strict database constraint limits 1 review per transaction.
- **Automated Rating Recalculation:** A database trigger automatically recalculates and updates the seller's star score (`★ 4.9`) on the `users` table upon review submission.
- **Profile Display:** Profile showcases received verified reviews, star breakdowns, and buyer testimonials.

### 3. Media & Presentation
- **Video Listings:** Post listings with up to 60s presentation video clips (MP4/WebM/MOV) stored in the `listing-videos` storage bucket.
- **Video & Photo Swipe Feed:** Fullscreen TikTok-style "Feed" tab mixing video and high-res photos.
- **Category Chips & Search:** Search bar with live category filtering (Vintage & Tees, Jackets, Denim, Shoes, Sports, Caps & Gear).
- **Listing Management:** Sellers can permanently delete their active listings with one click.

### 4. Authentication & Security
- **Email/Password Auth** with Supabase Auth.
- **Password Recovery:** Forgot-password email reset link and secure password update modal.
- **Row-Level Security (RLS):** All tables (`users`, `listings`, `messages`, `transactions`, `reviews`, `offers`) locked down by Postgres policies.
- **SQL Migrations:**
  - `supabase/schema.sql`: Base profiles & listings
  - `supabase/002_photos_and_messages.sql`: Photos bucket & private messaging
  - `setup_transactions.sql`: Safe Trade escrow & offers
  - `supabase/004_lock_down_profiles_and_listings.sql`: Security hardening
  - `supabase/005_listing_videos.sql`: Listing video bucket & schema
  - `supabase/006_verified_reviews.sql`: Verified reviews table & rating trigger

### 5. Stripe Integration Architecture
- `src/fees.js`: Configurable fee engine.
- `src/stripe.js`: Client-side Stripe checkout payload builder.
- `supabase/functions/create-checkout-session/index.ts`: Edge function for automated card processing with escrow hold.

---

## Real-Life Testing Instructions (Brother Test Scenario)

1. **Step 1 (Seller):**
   - Log in to your ReWear account on the live app or local build.
   - Go to **Post Item**, upload photos/video, set title and price (e.g. $15.00), and publish.
2. **Step 2 (Buyer - Brother):**
   - Brother logs in on a second account (or your test buyer account).
   - Finds your item in the Browse feed and clicks **Buy Now**.
   - Inspects the transparent fee breakdown ($15.00 + $1.10 Safe Trade Protection = $16.10) and clicks **Confirm & Reserve**.
3. **Step 3 (Post Office Drop-Off & Tracking):**
   - Seller opens **Profile -> Your Sales**, accepts the sale, and packs the shirt.
   - Seller takes package to the post office and ships to brother's address.
   - Seller taps **Mark as Shipped**, enters the USPS tracking number from the post office receipt.
4. **Step 4 (Delivery Confirmation & Verified Review):**
   - Brother receives the package in the mail.
   - Brother opens **Profile -> Your Purchases**, clicks **Confirm Delivery**.
   - Brother clicks **⭐ Rate Seller**, chooses 5 stars, writes a note, and submits.
   - Check seller's profile — the verified rating badge and review testimonial are immediately live!
