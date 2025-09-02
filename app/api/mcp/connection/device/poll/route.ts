import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security';
import { auth } from '@/app/(auth)/auth-simple';
import { consumeDeviceLink, getDeviceLinkByDeviceCode } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { rateLimit } from '@/lib/http/rate-limit';
import { getClientIp } from '@/lib/http/ip';

const bodySchema = z.object({
  device_code: z.string().min(16),
});

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }
    // Per-IP rate limit; polling interval is 5s, allow generous burst
    const ip = getClientIp(request);
    const { allowed } = await rateLimit({
      key: `device:poll:${ip}`,
      windowMs: 60_000,
      max: 120,
    });
    if (!allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
    const body = await request.json();
    const { device_code } = bodySchema.parse(body);
    const link = await getDeviceLinkByDeviceCode(device_code);
    if (!link) {
      return NextResponse.json(
        { error: 'invalid_device_code' },
        { status: 400 },
      );
    }

    const now = new Date();
    if (new Date(link.expiresAt) < now) {
      return NextResponse.json({ status: 'expired' });
    }
    if (link.status === 'pending') {
      return NextResponse.json({ status: 'pending' });
    }
    if (link.status === 'consumed') {
      return NextResponse.json({ status: 'consumed' });
    }
    if (link.status === 'approved') {
      // If not logged in, require login to persist
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json({ status: 'approved_requires_login' });
      }

      const { siteUrl, jwt, writeMode } = await consumeDeviceLink({
        deviceCode: device_code,
        userId: session.user.id,
      });

      const res = NextResponse.json({
        status: 'approved',
        siteUrl,
        writeMode: !!writeMode,
      });
      try {
        res.cookies.set('wp_base', siteUrl.replace(/\/$/, ''), {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
        res.cookies.set('wp_jwt', jwt, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
        res.cookies.set('wp_write_mode', writeMode ? '1' : '0', {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
      } catch {}
      return res;
    }

    return NextResponse.json({ status: link.status });
  } catch (error: any) {
    console.error('device/poll failed:', error);
    if (error instanceof ChatSDKError && error.type === 'payment_required') {
      return NextResponse.json(
        {
          error: 'plan_limit',
          message: error.cause || 'Upgrade required to link more sites.',
        },
        { status: 402 },
      );
    }
    const message =
      typeof error?.message === 'string' ? error.message : 'poll_failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
