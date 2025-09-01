import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth-simple';
import { getWordPressConnectionByUserId } from '@/lib/db/queries';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ connected: false, siteUrl: null, writeMode: false });
    }
    const conn = await getWordPressConnectionByUserId(session.user.id);
    return NextResponse.json({
      connected: !!conn,
      siteUrl: conn?.siteUrl ?? null,
      writeMode: conn?.writeMode ?? false,
    });
  } catch (error) {
    console.error('Error checking connection status:', error);
    return NextResponse.json(
      { connected: false, siteUrl: null, writeMode: false },
      { status: 200 }
    );
  }
}
