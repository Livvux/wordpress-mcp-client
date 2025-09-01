import { NextResponse } from 'next/server';
import { isAllowedOrigin } from '@/lib/security';
import { auth } from '@/app/(auth)/auth-simple';
import { deleteWordPressConnectionByUserId } from '@/lib/db/queries';

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await deleteWordPressConnectionByUserId(session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 },
    );
  }
}
