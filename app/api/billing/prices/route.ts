import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

export async function GET() {
  try {
    const priceMonthlyId = process.env.STRIPE_PRICE_ID || '';
    const priceYearlyId = process.env.STRIPE_PRICE_ID_YEARLY || '';

    if (!process.env.STRIPE_SECRET_KEY || !priceMonthlyId) {
      return NextResponse.json({ ok: false, error: 'billing_not_configured' }, { status: 200 });
    }

    const stripe = getStripe();

    const [monthly, yearly] = await Promise.all([
      stripe.prices.retrieve(priceMonthlyId),
      priceYearlyId ? stripe.prices.retrieve(priceYearlyId) : Promise.resolve(null),
    ]);

    function normalize(p: any) {
      if (!p) return null;
      return {
        id: p.id as string,
        currency: (p.currency as string) || 'usd',
        amount: typeof p.unit_amount === 'number' ? p.unit_amount : null, // in cents
        interval: p.recurring?.interval || 'month',
        intervalCount: p.recurring?.interval_count || 1,
      };
    }

    return NextResponse.json({
      ok: true,
      monthly: normalize(monthly),
      yearly: normalize(yearly),
    });
  } catch (err) {
    console.error('prices_api_error', err);
    return NextResponse.json({ ok: false, error: 'prices_fetch_failed' }, { status: 200 });
  }
}

