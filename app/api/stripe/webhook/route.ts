import 'server-only';
import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';
import { subscription as subscriptionTable, user as userTable } from '@/lib/db/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function upsertSubscriptionByUserId(params: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd?: Date | null;
}) {
  if (!process.env.POSTGRES_URL) return;
  const db = drizzle(postgres(process.env.POSTGRES_URL));
  const rows = await db
    .select({ id: subscriptionTable.id })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.userId, params.userId))
    .limit(1);

  if (rows.length > 0) {
    await db
      .update(subscriptionTable)
      .set({
        stripeCustomerId: params.stripeCustomerId,
        stripeSubscriptionId: params.stripeSubscriptionId,
        status: params.status,
        currentPeriodEnd: params.currentPeriodEnd ?? null,
      })
      .where(eq(subscriptionTable.userId, params.userId));
  } else {
    await db.insert(subscriptionTable).values({
      userId: params.userId,
      stripeCustomerId: params.stripeCustomerId,
      stripeSubscriptionId: params.stripeSubscriptionId,
      status: params.status,
      currentPeriodEnd: params.currentPeriodEnd ?? null,
    });
  }
}

async function updateSubscriptionByCustomerId(params: {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd?: Date | null;
}) {
  if (!process.env.POSTGRES_URL) return;
  const db = drizzle(postgres(process.env.POSTGRES_URL));
  await db
    .update(subscriptionTable)
    .set({
      stripeSubscriptionId: params.stripeSubscriptionId,
      status: params.status,
      currentPeriodEnd: params.currentPeriodEnd ?? null,
    })
    .where(eq(subscriptionTable.stripeCustomerId, params.stripeCustomerId));
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { ok: false, error: 'Missing STRIPE_WEBHOOK_SECRET' },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const sig = req.headers.get('stripe-signature');
  const buf = Buffer.from(await req.arrayBuffer());

  let event: Stripe.Event;
  try {
    if (!sig) throw new Error('Missing signature');
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err?.message);
    return new NextResponse('Bad signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const data = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = (data.subscription as string) || '';
        const customerId = (data.customer as string) || '';
        let userId = (data.metadata?.userId as string) || '';

        // Retrieve subscription to read status/period end and metadata
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          if (!userId) userId = (sub.metadata?.userId as string) || '';
          await upsertSubscriptionByUserId({
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status: sub.status,
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
          });
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = (sub.customer as string) || '';
        const userId = (sub.metadata?.userId as string) || '';
        const status = sub.status;
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : null;

        if (userId) {
          await upsertSubscriptionByUserId({
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            status,
            currentPeriodEnd: periodEnd,
          });
        } else if (customerId) {
          await updateSubscriptionByCustomerId({
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            status,
            currentPeriodEnd: periodEnd,
          });
        }
        break;
      }
      default:
        // no-op for other events
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

