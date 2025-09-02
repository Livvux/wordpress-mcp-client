import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/session-server';

export async function POST() {
  try {
    await deleteSession();
    const res = NextResponse.json({ ok: true });
    // Also clear WordPress cookies for safety
    try {
      res.cookies.set('wp_base', '', { maxAge: 0, path: '/' });
      res.cookies.set('wp_jwt', '', { maxAge: 0, path: '/' });
      res.cookies.set('wp_refresh', '', { maxAge: 0, path: '/' });
      res.cookies.set('wp_write_mode', '', { maxAge: 0, path: '/' });
    } catch {}
    return res;
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
