import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/app/(auth)/auth-simple';
import { listWordPressConnectionsByUserId } from '@/lib/db/queries';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [list, cookieStore] = await Promise.all([
      listWordPressConnectionsByUserId(session.user.id),
      cookies(),
    ]);
    const activeSite = cookieStore.get('wp_base')?.value || null;

    const out = list.map((c) => ({
      siteUrl: c.siteUrl,
      writeMode: !!c.writeMode,
      updatedAt: c.updatedAt,
      lastUsedAt: c.lastUsedAt,
      isActive: activeSite
        ? c.siteUrl.replace(/\/$/, '') === activeSite
        : false,
    }));
    return NextResponse.json({ connections: out });
  } catch (error) {
    console.error('Error listing connections:', error);
    return NextResponse.json(
      { error: 'Failed to list connections' },
      { status: 500 },
    );
  }
}
