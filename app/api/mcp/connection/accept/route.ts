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
  refresh: z.string().optional(),
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

    const { site, token, write, refresh, next } = parsed.data;

    // Require login to persist connection and set session cookies.
    // If not logged in, redirect to login preserving the intended accept URL.
    const session = await auth();
    if (!session?.user) {
      const encodedNext = encodeURIComponent(request.url);
      return NextResponse.redirect(`/login?next=${encodedNext}`);
    }

    // Persist to DB for the authenticated user
    await upsertWordPressConnection({
      userId: session.user.id,
      siteUrl: site,
      jwt: token,
      writeMode: !!write,
    });

    // Set cookies for subsequent MCP calls (bound to this logged-in browser)
    const redirectTo = next?.startsWith('http') ? next : '/admin/wp-plugin?connected=1';
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
      if (refresh) {
        res.cookies.set('wp_refresh', refresh, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 30, // 30 days
          path: '/',
        });
      }
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
