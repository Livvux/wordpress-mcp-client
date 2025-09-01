import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { AUTH_ENABLED, isOss } from '@/lib/config';
import { WPClient } from '@/lib/wp/client';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session && AUTH_ENABLED) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}) as any);
  if (isOss) {
    return NextResponse.json(
      { ok: true, mode: 'oss', note: `Stubbed update for ${params.id}` },
      { status: 200 },
    );
  }
  const siteUrl = body.siteUrl;
  const jwt = body.jwt;
  if (!siteUrl || !jwt) {
    return NextResponse.json({ error: 'Missing siteUrl/jwt' }, { status: 400 });
  }
  const client = new WPClient(siteUrl, jwt);
  const result = await client.updatePost(params.id, body);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, data: result.data }, { status: 200 });
}
