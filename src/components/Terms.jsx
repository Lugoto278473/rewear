import React from 'react';
import '../styles/Terms.css';

// A plain-English starter. Not legal advice — have it reviewed before ReWear
// grows beyond a small community.
export default function Terms({ onClose }) {
  return (
    <div className="terms-overlay" onClick={onClose}>
      <div className="terms-box" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>Terms and Services</h2>
        <p className="terms-updated">Last updated: September 2026</p>

        <h3>1. Using ReWear</h3>
        <p>
          ReWear lets people buy and sell secondhand items. By making an
          account, you agree to these terms. If you're under 18, a parent or
          guardian should help you buy or sell.
        </p>

        <h3>2. Your account</h3>
        <p>
          Keep your password safe. You're responsible for what happens on your
          account. Please use a real email.
        </p>

        <h3>3. Selling</h3>
        <p>
          Only sell things you own. Describe them honestly, with real photos.
          No stolen, fake, illegal, dangerous, or recalled items.
        </p>

        <h3>4. Buying</h3>
        <p>
          Deals are between the buyer and the seller. ReWear doesn't own,
          check, or ship the items, and isn't responsible if a deal goes wrong.
          Meet in public places and be careful sending money.
        </p>

        <h3>5. Be respectful</h3>
        <p>
          No scams, spam, harassment, or hateful messages. We may remove
          listings or close accounts that break these rules.
        </p>

        <h3>6. Your info</h3>
        <p>
          We store your email, listings, photos, and messages so the app works.
          We don't sell your information.
        </p>

        <h3>7. Changes</h3>
        <p>
          We may update these terms. If you keep using ReWear after a change,
          you accept the new terms.
        </p>
      </div>
    </div>
  );
}
