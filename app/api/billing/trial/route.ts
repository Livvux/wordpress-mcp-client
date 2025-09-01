import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const trial = cookieStore.get('trial_until')?.value;
  let trialUntil: Date | null = null;
  if (trial) {
    const d = new Date(trial);
    if (!Number.isNaN(d.getTime())) trialUntil = d;
  }
  const expired = trialUntil ? Date.now() > trialUntil.getTime() : false;
  return NextResponse.json({
    trialUntil: trialUntil ? trialUntil.toISOString() : null,
    expired,
  });
}
