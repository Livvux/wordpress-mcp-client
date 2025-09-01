import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { AUTH_ENABLED, isOss } from '@/lib/config';

// Creates a Stripe Checkout Session via Stripe's REST API without SDK
export async function POST(request: Request) {
  const session = await getSession();
  if (!session && AUTH_ENABLED) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (isOss) {
    return NextResponse.json({ error: 'Unavailable in OSS' }, { status: 405 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const price = process.env.STRIPE_PRICE_ID;
  const successUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/billing/success`;
  const cancelUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/billing/cancel`;
  if (!secret || !price) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('success_url', successUrl);
  body.set('cancel_url', cancelUrl);
  body.append('line_items[0][price]', price);
  body.append('line_items[0][quantity]', '1');
  // Optionally pass metadata (e.g., userId)
  body.set('client_reference_id', session?.userId || 'anon');

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: data.error?.message || 'Stripe error' }, { status: 502 });
  }
  return NextResponse.json({ url: data.url }, { status: 200 });
}

