import 'server-only';
import { NextResponse } from 'next/server';
import { getStripe, getAppBaseUrl } from '@/lib/stripe';
import { getSession } from '@/lib/session-server';
import { BILLING_ENABLED, FREE_TRIAL_DAYS } from '@/lib/config';

export async function POST(req: Request) {
  try {
    if (!BILLING_ENABLED) {
      return NextResponse.json(
        { ok: false, error: 'Billing disabled' },
        { status: 400 },
      );
    }

    const session = await getSession();
    if (!session || session.userType === 'guest') {
      return NextResponse.json(
        { ok: false, error: 'Bitte einloggen, um zu abonnieren.' },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const interval = (body?.interval as 'monthly' | 'yearly' | undefined) || 'monthly';

    const priceMonthly = process.env.STRIPE_PRICE_ID;
    const priceYearly = process.env.STRIPE_PRICE_ID_YEARLY;
    const priceId = interval === 'yearly' ? priceYearly || priceMonthly : priceMonthly;
    const publishable = process.env.STRIPE_PUBLIC_KEY;
    if (!priceId || !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { ok: false, error: 'Stripe ist nicht vollständig konfiguriert.' },
        { status: 500 },
      );
    }

    const stripe = getStripe();
    const baseUrl = getAppBaseUrl();

    // Build Checkout Session for subscription with trial
    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: session.userId,
      customer_email: session.email || undefined,
      success_url: `${baseUrl}/account?upgrade_success=true`,
      cancel_url: `${baseUrl}/account?upgrade_canceled=true`,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: Number.isFinite(FREE_TRIAL_DAYS)
          ? Math.max(0, Math.floor(FREE_TRIAL_DAYS))
          : undefined,
        metadata: {
          userId: session.userId,
        },
      },
      allow_promotion_codes: true,
      metadata: {
        userId: session.userId,
      },
    });

    return NextResponse.json({ ok: true, url: checkout.url, publishable });
  } catch (err: any) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Checkout fehlgeschlagen' },
      { status: 500 },
    );
  }
}
