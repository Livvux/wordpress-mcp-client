import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/app/(auth)/auth-simple';
import { getWordPressConnectionByUserId } from '@/lib/db/queries';

export async function GET() {
  try {
    const session = await auth();
    if (session?.user) {
      const conn = await getWordPressConnectionByUserId(session.user.id);
      if (conn) {
        return NextResponse.json({
          connected: true,
          siteUrl: conn.siteUrl,
          writeMode: conn.writeMode ?? false,
        });
      }
    }

    // Fallback to cookie-based session (handshake from plugin without login)
    try {
      const cookieStore = await cookies();
      const wpBase = cookieStore.get('wp_base')?.value;
      const wpJwt = cookieStore.get('wp_jwt')?.value;
      const writeCookie = cookieStore.get('wp_write_mode')?.value;
      const writeMode = writeCookie === '1';
      return NextResponse.json({
        connected: !!wpBase && !!wpJwt,
        siteUrl: wpBase ?? null,
        writeMode: !!writeMode,
      });
    } catch {
      return NextResponse.json({ connected: false, siteUrl: null, writeMode: false });
    }
  } catch (error) {
    console.error('Error checking connection status:', error);
    return NextResponse.json(
      { connected: false, siteUrl: null, writeMode: false },
      { status: 200 },
    );
  }
}
