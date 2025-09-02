import { NextResponse } from 'next/server';
import { isAllowedOrigin } from '@/lib/security';
import { createDeviceLinkEntry } from '@/lib/db/queries';
import { rateLimit } from '@/lib/http/rate-limit';
import { getClientIp } from '@/lib/http/ip';

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }
    // Per-IP rate limiting to deter abuse
    const ip = getClientIp(request);
    const { allowed } = await rateLimit({
      key: `device:start:${ip}`,
      windowMs: 60_000,
      max: 10,
    });
    if (!allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
    // Optional custom TTL from client, otherwise default 10 minutes
    let ttl = 600;
    try {
      const body = await request.json().catch(() => ({}));
      if (typeof body?.ttl === 'number' && body.ttl >= 60 && body.ttl <= 1800) {
        ttl = Math.floor(body.ttl);
      }
    } catch {}

    const link = await createDeviceLinkEntry(ttl);
    const expiresIn = Math.max(
      1,
      Math.floor((new Date(link.expiresAt).getTime() - Date.now()) / 1000),
    );
    return NextResponse.json({
      device_code: link.deviceCode,
      user_code: link.userCode,
      expires_in: expiresIn,
      interval: 5,
    });
  } catch (error) {
    console.error('device/start failed:', error);
    return NextResponse.json(
      { error: 'Failed to start device flow' },
      { status: 500 },
    );
  }
}
