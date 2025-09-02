import 'server-only';
import { NextResponse } from 'next/server';
import { getStripe, getAppBaseUrl } from '@/lib/stripe';
import { getSession } from '@/lib/session-server';
import { BILLING_ENABLED } from '@/lib/config';
import { eq } from 'drizzle-orm';
import { subscription } from '@/lib/db/schema';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

export async function POST() {
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
        { ok: false, error: 'Bitte einloggen.' },
        { status: 401 },
      );
    }

    if (!process.env.POSTGRES_URL) {
      return NextResponse.json(
        { ok: false, error: 'DB not configured' },
        { status: 500 },
      );
    }

    const client = postgres(process.env.POSTGRES_URL);
    const db = drizzle(client);

    // Ensure migrations are applied in dev environments
    try {
      await migrate(db as any, { migrationsFolder: './lib/db/migrations' });
    } catch {}

    const rows = await db
      .select({ customerId: subscription.stripeCustomerId })
      .from(subscription)
      .where(eq(subscription.userId, session.userId))
      .limit(1);

    const customerId = rows[0]?.customerId || undefined;
    if (!customerId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Kein Stripe-Kunde gefunden. Bitte zuerst ein Abo über Checkout starten.',
        },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getAppBaseUrl()}/account`,
    });

    return NextResponse.json({ ok: true, url: portal.url });
  } catch (err: any) {
    console.error('Stripe portal error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Portal fehlgeschlagen' },
      { status: 500 },
    );
  }
}
