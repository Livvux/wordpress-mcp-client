import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security';
import { auth } from '@/app/(auth)/auth-simple';
import { updateWordPressWriteMode } from '@/lib/db/queries';

const requestSchema = z.object({
  enabled: z.boolean(),
});

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { enabled } = requestSchema.parse(body);
    await updateWordPressWriteMode({ userId: session.user.id, enabled });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating write mode:', error);
    return NextResponse.json(
      { error: 'Failed to update write mode' },
      { status: 400 }
    );
  }
}
