import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { AUTH_ENABLED, isOss } from '@/lib/config';
import { isAllowedOrigin } from '@/lib/security';
import { WPClient } from '@/lib/wp/client';
import { makeIdempotencyKey, idemGet, idemSet } from '@/lib/http/idempotency';
import { rateLimit } from '@/lib/http/rate-limit';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session && AUTH_ENABLED) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  if (isOss) {
    return NextResponse.json(
      { ok: true, mode: 'oss', note: 'Stubbed media upload' },
      { status: 200 },
    );
  }

  try {
    const reqId = request.headers.get('x-req-id') || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
    // Rate limit media uploads per user/site
    const rlKey = `media:${session?.userId || 'anon'}`;
    const { allowed, remaining } = await rateLimit({ key: rlKey, windowMs: 60_000, max: 5 });
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const form = await request.formData();
    const file = form.get('file');
    const siteUrl = String(form.get('siteUrl') || '');
    const jwt = String(form.get('jwt') || '');
    if (!file || typeof (file as any).arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if (!siteUrl || !jwt) {
      return NextResponse.json(
        { error: 'Missing siteUrl/jwt' },
        { status: 400 },
      );
    }

    const f = file as File;
    // Write-mode gating (simple cookie-based gate)
    try {
      const cookieMod = await import('next/headers');
      const store = await cookieMod.cookies();
      const writeMode = store.get('wp_write_mode')?.value === '1';
      if (!writeMode) {
        return NextResponse.json({ error: 'Write mode disabled' }, { status: 403 });
      }
    } catch {}
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (typeof f.size === 'number' && f.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large (max 10MB)' },
        { status: 413 },
      );
    }

    // Idempotency
    const idemKey = request.headers.get('Idempotency-Key') || undefined;
    const routeId = 'POST:/api/wp/media';
    if (idemKey) {
      const cacheKey = makeIdempotencyKey(routeId, idemKey, { siteUrl, name: (f as any).name, size: f.size });
      const cached = await idemGet(cacheKey);
      if (cached) {
        const res = NextResponse.json(cached.body, { status: cached.status });
        res.headers.set('X-Idempotent-Replay', 'true');
        res.headers.set('Vary', 'Origin');
        res.headers.set('X-Req-Id', String(reqId));
        return res;
      }
    }

    const client = new WPClient(siteUrl, jwt);
    const result = await client.uploadMedia(f);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 502 },
      );
    }
    const payload = { ok: true, data: result.data };
    const res = NextResponse.json(payload, { status: 201 });
    res.headers.set('Vary', 'Origin');
    res.headers.set('X-Req-Id', String(reqId));
    if (idemKey) {
      const cacheKey = makeIdempotencyKey(routeId, idemKey, { siteUrl, name: (f as any).name, size: f.size });
      await idemSet(cacheKey, { status: 201, body: payload });
    }
    return res;
  } catch (error) {
    console.error('Media upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload media' },
      { status: 500 },
    );
  }
}
