import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { AUTH_ENABLED, isOss } from '@/lib/config';
import { WPClient, type WPUpdatePostInput } from '@/lib/wp/client';

export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session && AUTH_ENABLED) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // In a real impl, read JSON body: siteUrl, jwt, and fields to update.
  // Skeleton returns not implemented in premium, stub in OSS.
  if (isOss) {
    return NextResponse.json({ ok: true, mode: 'oss', note: `Stubbed update for ${params.id}` }, { status: 200 });
  }

  return NextResponse.json({ ok: false, error: 'Not implemented' }, { status: 501 });
}

