import React, { useEffect, useRef, useState } from 'react';
import '../styles/Feed.css';

// Full-screen, swipe-up feed mixing video and photo listings. Video is
// optional for sellers, so photo listings get equal space: tap to flip.

function FeedItem({ listing, isOwn, active, onBuyNow, onMakeOffer, onMessage }) {
  const videoRef = useRef(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [copied, setCopied] = useState(false);
  const photos = listing.images?.length ? listing.images : [];

  const handleShare = async () => {
    const shareData = {
      title: `${listing.title} on ReWear`,
      text: `Check out this ${listing.title} ($${listing.price}) on ReWear!`,
      url: window.location.href.split('?')[0] + `?item=${listing.id}`,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(shareData.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  };

  // Only the item on screen plays.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) v.play().catch(() => {});
    else {
      v.pause();
      v.currentTime = 0;
    }
  }, [active]);

  return (
    <section className="feed-item">
      {listing.video_url ? (
        <video
          ref={videoRef}
          className="feed-media"
          src={listing.video_url}
          poster={photos[0]}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          onClick={() => setMuted((m) => !m)}
        />
      ) : photos.length ? (
        <button
          className="feed-media feed-photo"
          onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
          aria-label="Next photo"
        >
          <img src={photos[photoIndex]} alt={listing.title} loading="lazy" />
        </button>
      ) : (
        <div className="feed-media feed-nophoto">No photo</div>
      )}

      {listing.video_url ? (
        <span className="feed-hint">{muted ? '🔇 Tap for sound' : '🔊'}</span>
      ) : (
        photos.length > 1 && (
          <div className="feed-dots">
            {photos.map((_, i) => (
              <span key={i} className={i === photoIndex ? 'on' : ''} />
            ))}
          </div>
        )
      )}

      <div className="feed-overlay">
        <div className="feed-info">
          <strong className="feed-price">${listing.price}</strong>
          <h3>{listing.title}</h3>
          <p className="feed-seller">
            @{listing.users?.username} · {listing.condition}
          </p>
          {listing.description && <p className="feed-desc">{listing.description}</p>}
        </div>

        <div className="feed-actions">
          {!isOwn && (
            <>
              <button onClick={() => onBuyNow(listing)}>
                <span>🛍️</span>Buy
              </button>
              <button onClick={() => onMakeOffer(listing)}>
                <span>💸</span>Offer
              </button>
              <button onClick={() => onMessage(listing)}>
                <span>💬</span>Message
              </button>
            </>
          )}
          <button onClick={handleShare}>
            <span>{copied ? '✓' : '↗️'}</span>{copied ? 'Copied' : 'Share'}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function Feed({ listings, userId, onBuyNow, onMakeOffer, onMessage }) {
  const [activeId, setActiveId] = useState(listings[0]?.id ?? null);
  const containerRef = useRef(null);

  // Whichever item is mostly on screen is "active".
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveId(e.target.dataset.id);
        }
      },
      { root, threshold: 0.6 }
    );
    root.querySelectorAll('[data-id]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [listings]);

  if (listings.length === 0) {
    return <p className="feed-empty">Nothing here yet. Be the first to post!</p>;
  }

  return (
    <div className="feed" ref={containerRef}>
      {listings.map((listing) => (
        <div key={listing.id} data-id={listing.id} className="feed-snap">
          <FeedItem
            listing={listing}
            isOwn={listing.seller_id === userId}
            active={activeId === listing.id}
            onBuyNow={onBuyNow}
            onMakeOffer={onMakeOffer}
            onMessage={onMessage}
          />
        </div>
      ))}
    </div>
  );
}
