import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/app/(auth)/auth-simple';
import { hasActiveSubscription } from '@/lib/db/queries';

export async function GET() {
  try {
    const [authData, cookieStore] = await Promise.all([auth(), cookies()]);

    const session = authData?.session || null;
    const dbUser = authData?.user || null;

    let active = false;
    if (dbUser?.id) {
      try {
        active = await hasActiveSubscription(dbUser.id);
      } catch (_) {
        active = false;
      }
    }

    const trialCookie = cookieStore.get('trial_until')?.value;
    let trialUntil: Date | null = null;
    if (trialCookie) {
      const d = new Date(trialCookie);
      if (!Number.isNaN(d.getTime())) trialUntil = d;
    }
    const trialExpired = trialUntil ? Date.now() > trialUntil.getTime() : false;

    return NextResponse.json({
      ok: true,
      userType: session?.userType ?? 'guest',
      hasActiveSubscription: !!active,
      plan: active ? 'pro' : 'free',
      trialUntil: trialUntil ? trialUntil.toISOString() : null,
      trialExpired,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'failed_to_resolve_billing_status' },
      { status: 200 },
    );
  }
}

