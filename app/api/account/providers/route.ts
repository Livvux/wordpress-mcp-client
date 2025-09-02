import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getLinkedAccounts } from '@/lib/db/queries';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const accounts = await getLinkedAccounts(userId);

    const enabledProviders = {
      google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      twitter: !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET),
    };

    const linked = new Set(accounts.map((a) => a.provider));
    const items = [
      { id: 'google', name: 'Google', enabled: enabledProviders.google, linked: linked.has('google') },
      { id: 'twitter', name: 'X (Twitter)', enabled: enabledProviders.twitter, linked: linked.has('twitter') },
      { id: 'password', name: 'Email & Password', enabled: true, linked: true },
    ];

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

