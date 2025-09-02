import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: true, session: null }, { status: 200 });
    }
    return NextResponse.json({ ok: true, session }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'failed' }, { status: 200 });
  }
}
