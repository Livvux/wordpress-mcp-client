import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security';
import { approveDeviceLinkByUserCode } from '@/lib/db/queries';
import { rateLimit } from '@/lib/http/rate-limit';
import { getClientIp } from '@/lib/http/ip';

const bodySchema = z.object({
  user_code: z.string().min(4),
  site: z.string().url(),
  token: z.string().min(1),
  write: z.boolean().optional().default(false),
  pluginVersion: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    // Allow server-to-server without Origin; still block explicit bad origins
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }
    // Per-IP rate limit to avoid brute forcing user_code
    const ip = getClientIp(request);
    const { allowed } = await rateLimit({
      key: `device:activate:${ip}`,
      windowMs: 60_000,
      max: 30,
    });
    if (!allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
    const body = await request.json();
    const { user_code, site, token, write, pluginVersion } =
      bodySchema.parse(body);
    await approveDeviceLinkByUserCode({
      userCode: user_code.trim().toUpperCase(),
      siteUrl: site.replace(/\/$/, ''),
      jwt: token,
      writeMode: !!write,
      pluginVersion: pluginVersion ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('device/activate failed:', error);
    const message =
      error instanceof Error ? error.message : 'Activation failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
