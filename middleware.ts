import { NextResponse, type NextRequest } from 'next/server';

// In middleware, we must read cookies from the request directly.
// The server-side helper uses next/headers cookies(), which is not supported here.
function getSessionFromRequest(request: NextRequest) {
  try {
    const cookie = request.cookies.get('mcp_session');
    if (!cookie?.value) return null;
    let session: any = null;
    try {
      session = JSON.parse(cookie.value);
    } catch {
      // If the session cookie is encrypted/signed, we cannot parse it at the edge.
      // Presence of a non-empty cookie is sufficient to allow the request to proceed;
      // server-side handlers will fully validate and enrich the session.
      return {} as any;
    }
    // Minimal validation
    if (
      !session ||
      typeof session.userId !== 'string' ||
      session.userId.length === 0
    ) {
      return null;
    }
    // Ensure user object exists (parity with server helper)
    if (!session.user) {
      session.user = {
        id: session.userId,
        email: session.email || null,
        name:
          session.userType === 'guest'
            ? 'Guest User'
            : session.email?.split('@')[0] || 'User',
        image: null,
        type: session.userType,
      };
    }
    return session;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith('/ping')) {
    return new Response('pong', { status: 200 });
  }

  // Allow auth endpoints, setup page and session API
  if (
    pathname.startsWith('/api/auth') ||
    pathname === '/setup' ||
    pathname === '/api/session'
  ) {
    return NextResponse.next();
  }

  // Check for session (read from request, not next/headers)
  const session = getSessionFromRequest(request);

  // Admin routes are protected by server layouts (DB-aware RBAC). No edge gating here.

  // Always allow access to login/register pages (even if guest session exists)
  if (pathname === '/login' || pathname === '/register') {
    return NextResponse.next();
  }

  if (!session) {
    const redirectUrl = encodeURIComponent(request.url);

    // Redirect to guest auth to create session
    return NextResponse.redirect(
      new URL(`/api/auth/guest?redirectUrl=${redirectUrl}`, request.url),
    );
  }

  // Redirect only fully authenticated (non-guest) users away from login/register pages
  // Note: handled above by early return for /login and /register

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/chat/:id',
    '/api/:path*',
    '/login',
    '/register',

    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
