// ReWear Stripe Integration Module
// Supports seamless transition from prototype Safe Trade to live credit card escrow.

import { calculateBuyerFee, calculateBuyerTotal } from './fees';

export const STRIPE_PUBLISHABLE_KEY =
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || '';

export const isStripeConfigured = Boolean(
  STRIPE_PUBLISHABLE_KEY && STRIPE_PUBLISHABLE_KEY.startsWith('pk_')
);

/**
 * Creates a Stripe checkout session payload for an item.
 * Incorporates 0% seller fee and 4% + $0.50 Safe Trade buyer protection.
 */
export function buildStripeCheckoutPayload({ listing, buyerEmail }) {
  const itemPrice = Number(listing.price);
  const buyerFee = calculateBuyerFee(itemPrice);
  const total = calculateBuyerTotal(itemPrice);

  return {
    customer_email: buyerEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: listing.title,
            description: `Secondhand item sold by @${listing.users?.username || 'seller'} on ReWear`,
            images: listing.images && listing.images.length > 0 ? [listing.images[0]] : [],
          },
          unit_amount: Math.round(itemPrice * 100), // in cents
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'ReWear Safe Trade Buyer Protection',
            description: 'Escrow protection guarantee (funds held until delivery is confirmed)',
          },
          unit_amount: Math.round(buyerFee * 100), // in cents
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    metadata: {
      listing_id: listing.id,
      seller_id: listing.seller_id,
      item_price: itemPrice.toString(),
      protection_fee: buyerFee.toString(),
      total_amount: total.toString(),
    },
    success_url: `${window.location.origin}/?session_id={CHECKOUT_SESSION_ID}&order_success=true`,
    cancel_url: `${window.location.origin}/?order_cancelled=true`,
  };
}
