import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { AUTH_ENABLED, isOss } from '@/lib/config';
import { WPClient, type WPCreatePostInput } from '@/lib/wp/client';
import { hasPremium } from '@/lib/premium';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session && AUTH_ENABLED) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as (WPCreatePostInput & { siteUrl?: string; jwt?: string }) | null;
  if (!body || !body.title || !body.content) {
    return NextResponse.json({ error: 'Missing title/content' }, { status: 400 });
  }
  const siteUrl = body.siteUrl;
  const jwt = body.jwt;

  if (isOss) {
    return NextResponse.json({ ok: true, mode: 'oss', note: 'Stubbed create post' }, { status: 200 });
  }

  if (!siteUrl || !jwt) {
    return NextResponse.json({ error: 'Missing siteUrl/jwt' }, { status: 400 });
  }

  const allowed = await hasPremium(session);
  if (!allowed) {
    return NextResponse.json({ error: 'Payment required' }, { status: 402 });
  }

  const client = new WPClient(siteUrl, jwt || undefined);
  const result = await client.createPost(body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
}
