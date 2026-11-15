// Supabase Edge Function: create-checkout-session
// Handles secure Stripe Checkout creation with ReWear's Safe Trade fee structure.
//
// Deploy with: supabase functions deploy create-checkout-session
// Set secret with: supabase secrets set STRIPE_SECRET_KEY=sk_test_...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not set in Supabase secrets.');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const body = await req.json();
    const { listing, buyerEmail, origin } = body;

    const itemPrice = Number(listing.price);
    // 4% + $0.50 buyer protection fee
    const buyerFee = Math.round((itemPrice * 0.04 + 0.5) * 100) / 100;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: buyerEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: listing.title,
              description: `Secondhand clothing on ReWear`,
              images: listing.images?.length ? [listing.images[0]] : [],
            },
            unit_amount: Math.round(itemPrice * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Safe Trade Buyer Protection',
              description: 'Funds held in escrow until delivery is confirmed',
            },
            unit_amount: Math.round(buyerFee * 100),
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
      },
      success_url: `${origin || 'https://rewear-cupm.vercel.app'}/?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${origin || 'https://rewear-cupm.vercel.app'}/?cancelled=true`,
    });

    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
