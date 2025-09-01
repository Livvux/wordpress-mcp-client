import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { getSubscriptionByUserId } from '@/lib/db/queries';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const sub = await getSubscriptionByUserId(session.userId);
  if (!sub || !sub.stripeCustomerId) {
    return NextResponse.json({ error: 'No Stripe customer' }, { status: 404 });
  }

  const returnUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/settings/billing`;
  const body = new URLSearchParams();
  body.set('customer', sub.stripeCustomerId);
  body.set('return_url', returnUrl);

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
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

