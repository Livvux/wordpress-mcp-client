import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const locale = typeof body?.locale === 'string' && body.locale.startsWith('de') ? 'de' : 'en';
    const res = NextResponse.json({ ok: true, locale });
    res.cookies.set('NEXT_LOCALE', locale, { path: '/' });
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
