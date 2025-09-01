import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/app/(auth)/auth-simple';
import { upsertWordPressConnection } from '@/lib/db/queries';

const querySchema = z.object({
  site: z.string().url(),
  token: z.string().min(1),
  write: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true' || v === 'yes'),
  next: z.string().url().optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      site: url.searchParams.get('site') ?? '',
      token: url.searchParams.get('token') ?? '',
      write: url.searchParams.get('write') ?? undefined,
      next: url.searchParams.get('next') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { site, token, write, next } = parsed.data;

    // Optionally persist to DB if user is signed in
    try {
      const session = await auth();
      if (session?.user) {
        await upsertWordPressConnection({
          userId: session.user.id,
          siteUrl: site,
          jwt: token,
          writeMode: !!write,
        });
      }
    } catch (e) {
      // Non-fatal: we still set cookies for this browser session
      console.warn('Accept connection: DB upsert skipped or failed', e);
    }

    // Set cookies for subsequent MCP calls
    const redirectTo = next && next.startsWith('http') ? next : '/';
    const res = NextResponse.redirect(redirectTo);
    try {
      res.cookies.set('wp_base', site.replace(/\/$/, ''), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
      res.cookies.set('wp_jwt', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
      if (typeof write === 'boolean') {
        res.cookies.set('wp_write_mode', write ? '1' : '0', {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
      }
    } catch {}

    return res;
  } catch (error) {
    console.error('Accept connection failed:', error);
    return NextResponse.json(
      { error: 'Failed to accept connection' },
      { status: 500 },
    );
  }
}

