import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { AUTH_ENABLED, isOss } from '@/lib/config';
import { WPClient } from '@/lib/wp/client';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session && AUTH_ENABLED) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { siteUrl, jwt } = await request.json().catch(() => ({ siteUrl: null, jwt: null }));
  if (!siteUrl) {
    return NextResponse.json({ error: 'Missing siteUrl' }, { status: 400 });
  }

  if (isOss) {
    return NextResponse.json({ ok: true, mode: 'oss', note: 'Validation is a no-op in OSS mode' }, { status: 200 });
  }

  const client = new WPClient(siteUrl, jwt || undefined);
  const result = await client.validate();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
