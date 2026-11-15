// ReWear Fee Configuration
// Change these rates here anytime to adjust platform pricing.

export const FEES = {
  // Sellers keep 100% of their item price
  SELLER_COMMISSION_PERCENT: 0.0,

  // Buyer Safe Trade Protection Fee (undercutting Depop's 5% + $1.00)
  BUYER_FEE_PERCENT: 0.04, // 4%
  BUYER_FEE_FIXED: 0.5,    // $0.50 flat

  // Stripe processing cost reference (2.9% + $0.30)
  STRIPE_PERCENT: 0.029,
  STRIPE_FIXED: 0.3,
};

/**
 * Calculates the Safe Trade buyer protection fee for an item price.
 * Rounds to 2 decimal places.
 */
export function calculateBuyerFee(itemPrice) {
  const price = parseFloat(itemPrice) || 0;
  if (price <= 0) return 0;
  const fee = price * FEES.BUYER_FEE_PERCENT + FEES.BUYER_FEE_FIXED;
  return Math.round(fee * 100) / 100;
}

/**
 * Calculates the total cost for the buyer (item price + protection fee).
 */
export function calculateBuyerTotal(itemPrice) {
  const price = parseFloat(itemPrice) || 0;
  const fee = calculateBuyerFee(price);
  return Math.round((price + fee) * 100) / 100;
}

/**
 * Formats a fee breakdown object for receipts and modals.
 */
export function getPriceBreakdown(itemPrice) {
  const price = parseFloat(itemPrice) || 0;
  const fee = calculateBuyerFee(price);
  const total = calculateBuyerTotal(price);
  return {
    itemPrice: price.toFixed(2),
    fee: fee.toFixed(2),
    total: total.toFixed(2),
    sellerEarnings: price.toFixed(2),
  };
}
