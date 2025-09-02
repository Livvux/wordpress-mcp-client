import 'server-only';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth-simple';
import { getStripe, getAppBaseUrl } from '@/lib/stripe';
import { BILLING_ENABLED, FREE_TRIAL_DAYS } from '@/lib/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { subscription } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const interval = (searchParams.get('interval') as 'monthly' | 'yearly' | null) ?? 'monthly';

  if (!BILLING_ENABLED) {
    return NextResponse.redirect(new URL('/account', request.url), 302);
  }

  const authData = await auth();
  const session = authData?.session || null;
  const dbUser = authData?.user || null;

  if (!session || !dbUser?.id) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', '/upgrade');
    return NextResponse.redirect(loginUrl, 302);
  }

  const stripe = getStripe();
  const baseUrl = getAppBaseUrl();

  // Try to find existing Stripe customer for this user
  let customerId: string | null = null;
  if (process.env.POSTGRES_URL) {
    try {
      const db = drizzle(postgres(process.env.POSTGRES_URL));
      const rows = await db
        .select({ customerId: subscription.stripeCustomerId })
        .from(subscription)
        .where(eq(subscription.userId, dbUser.id))
        .limit(1);
      customerId = rows[0]?.customerId ?? null;
    } catch {}
  }

  if (customerId) {
    // Send to Stripe Customer Portal
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/account`,
    });
    return NextResponse.redirect(portal.url!, 302);
  }

  // No customer yet: create Checkout for first purchase
  const priceMonthly = process.env.STRIPE_PRICE_ID;
  const priceYearly = process.env.STRIPE_PRICE_ID_YEARLY;
  const priceId = interval === 'yearly' ? priceYearly || priceMonthly : priceMonthly;
  if (!priceId) {
    const u = new URL('/account', request.url);
    u.searchParams.set('billing_error', 'noprice');
    return NextResponse.redirect(u, 302);
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    client_reference_id: dbUser.id,
    customer_email: session.email || undefined,
    success_url: `${baseUrl}/account?upgrade_success=true`,
    cancel_url: `${baseUrl}/account?upgrade_canceled=true`,
    line_items: [ { price: priceId, quantity: 1 } ],
    subscription_data: {
      trial_period_days: Number.isFinite(FREE_TRIAL_DAYS)
        ? Math.max(0, Math.floor(FREE_TRIAL_DAYS))
        : undefined,
      metadata: { userId: dbUser.id },
    },
    allow_promotion_codes: true,
    metadata: { userId: dbUser.id },
  });

  return NextResponse.redirect(checkout.url!, 302);
}
