import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { AUTH_ENABLED, isOss } from '@/lib/config';
import { WPClient, type WPCreatePostInput } from '@/lib/wp/client';
import { isAllowedOrigin } from '@/lib/security';
import { makeIdempotencyKey, idemGet, idemSet } from '@/lib/http/idempotency';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session && AUTH_ENABLED) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | (WPCreatePostInput & { siteUrl?: string; jwt?: string })
    | null;
  if (!body || !body.title || !body.content) {
    return NextResponse.json(
      { error: 'Missing title/content' },
      { status: 400 },
    );
  }
  const siteUrl = body.siteUrl;
  const jwt = body.jwt;

  if (isOss) {
    return NextResponse.json(
      { ok: true, mode: 'oss', note: 'Stubbed create post' },
      { status: 200 },
    );
  }

  if (!siteUrl || !jwt) {
    return NextResponse.json({ error: 'Missing siteUrl/jwt' }, { status: 400 });
  }

  // Idempotency handling
  const idemKey = request.headers.get('Idempotency-Key') || undefined;
  const routeId = 'POST:/api/wp/posts';
  const reqId = request.headers.get('x-req-id') || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
  if (idemKey) {
    const cacheKey = makeIdempotencyKey(routeId, idemKey, body);
    const cached = await idemGet(cacheKey);
    if (cached) {
      const res = NextResponse.json(cached.body, { status: cached.status });
      res.headers.set('X-Idempotent-Replay', 'true');
      res.headers.set('Vary', 'Origin');
      res.headers.set('X-Req-Id', String(reqId));
      return res;
    }
  }

  // OSS-lite: no premium gating here; in premium branch this is enforced
  // Write-mode gating (simple cookie-based gate)
  try {
    const cookieMod = await import('next/headers');
    const store = await cookieMod.cookies();
    const writeMode = store.get('wp_write_mode')?.value === '1';
    if (!writeMode) {
      return NextResponse.json({ error: 'Write mode disabled' }, { status: 403 });
    }
  } catch {}

  const client = new WPClient(siteUrl, jwt || undefined);
  const result = await client.createPost(body);
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
    const cacheKey = makeIdempotencyKey(routeId, idemKey, body);
    await idemSet(cacheKey, { status: 201, body: payload });
  }
  return res;
}
