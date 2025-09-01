import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { upsertSubscription } from '@/lib/db/queries';

function verifyStripeSignature(rawBody: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader) return false;
  // Stripe style: t=timestamp,v1=signature
  const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=')) as [string, string][]);
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;
  const signedPayload = `${t}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const raw = await request.text();
  const signature = request.headers.get('stripe-signature');
  const ok = verifyStripeSignature(raw, signature, secret);
  if (!ok) {
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
  }

  const event = JSON.parse(raw);
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        const userId = s.client_reference_id as string | null;
        const stripeCustomerId = s.customer as string | null;
        const stripeSubscriptionId = s.subscription as string | null;
        const status = s.status === 'complete' ? 'active' : 'inactive';
        if (userId) {
          await upsertSubscription({
            userId,
            stripeCustomerId,
            stripeSubscriptionId,
            status,
          });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const stripeCustomerId = sub.customer as string | null;
        const stripeSubscriptionId = sub.id as string | null;
        const status = sub.status as string | undefined;
        // We rely on checkout.session to bind userId; here we update by userId if metadata contains it
        const userId = (sub.metadata && sub.metadata.userId) || null;
        if (userId) {
          await upsertSubscription({ userId, stripeCustomerId, stripeSubscriptionId, status });
        }
        break;
      }
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json({ error: 'Webhook handling failed' }, { status: 500 });
  }
}

