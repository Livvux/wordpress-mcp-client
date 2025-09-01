import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { AUTH_ENABLED, isOss } from '@/lib/config';

export async function POST() {
  const session = await getSession();
  if (!session && AUTH_ENABLED) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isOss) {
    return NextResponse.json(
      { ok: true, mode: 'oss', note: 'Stubbed media upload' },
      { status: 200 },
    );
  }

  return NextResponse.json(
    { ok: false, error: 'Not implemented' },
    { status: 501 },
  );
}
