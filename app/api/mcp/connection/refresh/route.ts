import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/app/(auth)/auth-simple';
import { isAllowedOrigin } from '@/lib/security';
import { upsertWordPressConnection } from '@/lib/db/queries';

function getOriginFromRequest(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const wpBase = cookieStore.get('wp_base')?.value?.replace(/\/$/, '');
    const wpRefresh = cookieStore.get('wp_refresh')?.value;
    const writeCookie = cookieStore.get('wp_write_mode')?.value;
    const writeMode = writeCookie === '1';

    if (!wpBase || !wpRefresh) {
      return NextResponse.json(
        { error: 'Missing WordPress refresh context' },
        { status: 400 },
      );
    }

    // Build manifest of origin for soft origin check on WP side
    const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
    const runtimeOrigin = envOrigin || getOriginFromRequest(request.url);

    const endpoint = `${wpBase}/wp-json/wpcursor/v1/auth/token`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: wpRefresh,
        origin: runtimeOrigin,
      }),
      // never cache
      cache: 'no-store',
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      // If refresh is invalid, clear cookies to force re-connect
      const out = NextResponse.json(
        { error: `Refresh failed: ${res.status} ${res.statusText}` },
        { status: 401 },
      );
      out.cookies.set('wp_jwt', '', { maxAge: 0, path: '/' });
      out.cookies.set('wp_refresh', '', { maxAge: 0, path: '/' });
      console.warn('WP refresh failure:', res.status, txt);
      return out;
    }

    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
    };

    const access = data.access_token || '';
    const rotatedRefresh = data.refresh_token || undefined;
    const ttl = typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 3600;

    if (!access) {
      return NextResponse.json(
        { error: 'Refresh succeeded but no access token returned' },
        { status: 502 },
      );
    }

    // Persist updated access token for this user
    await upsertWordPressConnection({
      userId: session.user.id,
      siteUrl: wpBase,
      jwt: access,
      writeMode: !!writeMode,
    });

    const out = NextResponse.json({ ok: true, accessToken: access, refreshToken: rotatedRefresh || null, expiresIn: ttl });
    // Update cookies with new tokens
    out.cookies.set('wp_base', wpBase, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      // keep base for a week; not sensitive
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    out.cookies.set('wp_jwt', access, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ttl, // align cookie lifetime to token ttl
      path: '/',
    });
    if (rotatedRefresh) {
      out.cookies.set('wp_refresh', rotatedRefresh, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        // assume 30 days typical; plugin enforces exp server-side
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      });
    }

    return out;
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh WordPress token' },
      { status: 500 },
    );
  }
}
