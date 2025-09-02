import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security';
import { auth } from '@/app/(auth)/auth-simple';
import {
  countWordPressConnectionsByUserId,
  getWordPressConnectionByUserAndSite,
  hasActiveSubscription,
  upsertWordPressConnection,
} from '@/lib/db/queries';

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

    // Enforce plan limit when adding a new site
    const existing = await getWordPressConnectionByUserAndSite({
      userId: session.user.id,
      siteUrl,
    });
    if (!existing) {
      const count = await countWordPressConnectionsByUserId(session.user.id);
      const roles = session.session.roles || [];
      const isAdmin = roles.includes('admin') || roles.includes('owner');
      const hasSub = await hasActiveSubscription(session.user.id);
      if (!isAdmin && !hasSub && count >= 1) {
        return NextResponse.json(
          {
            error: 'plan_limit',
            message:
              'Free plan supports only 1 connected site. Upgrade to add more.',
          },
          { status: 402 },
        );
      }
    }
    await upsertWordPressConnection({
      userId: session.user.id,
      siteUrl,
      jwt: jwtToken,
      writeMode: !!writeMode,
    });

    const res = NextResponse.json({ success: true });
    try {
      res.cookies.set('wp_base', siteUrl.replace(/\/$/, ''), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      res.cookies.set('wp_jwt', jwtToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    } catch {}

    return res;
  } catch (error) {
    console.error('Error saving connection:', error);
    return NextResponse.json(
      { error: 'Failed to save connection' },
      { status: 400 },
    );
  }
}
