import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { AUTH_ENABLED, isOss } from '@/lib/config';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session && AUTH_ENABLED) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { content } = await request.json().catch(() => ({ content: null }));
  if (!content) {
    return NextResponse.json({ error: 'Missing content' }, { status: 400 });
  }

  if (isOss) {
    return NextResponse.json(
      { ok: true, mode: 'oss', preview: { html: content } },
      { status: 200 },
    );
  }

  // TODO: run server-side rendering/validation (links, schema.org)
  return NextResponse.json(
    { ok: false, error: 'Not implemented' },
    { status: 501 },
  );
}
