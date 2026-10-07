import React from 'react';
import { distanceMiles, formatDistance } from '../location';
import '../styles/ListingCard.css';

// via.placeholder.com is dead, so the fallback is a local inline SVG.
const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Crect width='250' height='250' fill='%23f2f1ee'/%3E%3Ctext x='50%25' y='50%25' fill='%239ca3af' font-family='sans-serif' font-size='13' text-anchor='middle'%3ENo photo%3C/text%3E%3C/svg%3E";

export default function ListingCard({ listing, isOwn, viewerLocation, onBuyNow, onMakeOffer }) {
  const image =
    listing.images && listing.images.length > 0
      ? listing.images[0]
      : PLACEHOLDER;

  // numeric columns come back from Supabase as strings.
  const hasLocation = listing.lat != null && listing.lng != null && viewerLocation;
  const distance = hasLocation
    ? formatDistance(
        distanceMiles(viewerLocation, { lat: Number(listing.lat), lng: Number(listing.lng) })
      )
    : null;

  return (
    <div className="listing-card">
      <div className="listing-image">
        <img
          src={image}
          alt={listing.title}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = PLACEHOLDER;
          }}
        />
        <span className="condition">{listing.condition}</span>
      </div>
      <div className="listing-info">
        <h3>{listing.title}</h3>
        <p className="description">{listing.description}</p>
        <div className="listing-footer">
          <span className="price">${listing.price}</span>
          <span className="seller">by {listing.users?.username}</span>
        </div>
        <div className="listing-rating">
          {listing.users?.rating ? (
            <span>⭐ {listing.users.rating}</span>
          ) : (
            <span>New seller</span>
          )}
          {distance && <span className="distance">📍 {distance}</span>}
        </div>
        {isOwn ? (
          <button className="offer-btn disabled" disabled>
            Your listing
          </button>
        ) : (
          <div className="card-actions">
            <button className="offer-btn" onClick={() => onMakeOffer(listing)}>
              Make Offer
            </button>
            <button className="buy-btn" onClick={() => onBuyNow(listing)}>
              Buy Now
            </button>
            <p className="trust-note">Pay the seller directly — online payments coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
