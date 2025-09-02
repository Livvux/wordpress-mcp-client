import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { auth } from '@/app/(auth)/auth-simple';
import { getWordPressConnectionByUserAndSite } from '@/lib/db/queries';

const bodySchema = z.object({
  siteUrl: z.string().url(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteUrl } = bodySchema.parse(body);

    const conn = await getWordPressConnectionByUserAndSite({
      userId: session.user.id,
      siteUrl,
    });
    if (!conn) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const res = NextResponse.json({ success: true });
    try {
      const normalized = siteUrl.replace(/\/$/, '');
      res.cookies.set('wp_base', normalized, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      res.cookies.set('wp_jwt', conn.jwt, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      res.cookies.set('wp_write_mode', conn.writeMode ? '1' : '0', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    } catch {}

    return res;
  } catch (error) {
    console.error('Error selecting connection:', error);
    return NextResponse.json(
      { error: 'Failed to select connection' },
      { status: 400 },
    );
  }
}
