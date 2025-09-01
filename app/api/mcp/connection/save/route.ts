import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security';
import { auth } from '@/app/(auth)/auth-simple';
import { upsertWordPressConnection } from '@/lib/db/queries';

const requestSchema = z.object({
  siteUrl: z.string().url(),
  jwtToken: z.string().min(1),
  writeMode: z.boolean().optional().default(false),
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
    const { siteUrl, jwtToken, writeMode } = requestSchema.parse(body);
    await upsertWordPressConnection({
      userId: session.user.id,
      siteUrl,
      jwt: jwtToken,
      writeMode: !!writeMode,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving connection:', error);
    return NextResponse.json(
      { error: 'Failed to save connection' },
      { status: 400 }
    );
  }
}
