import { getOrCreateSession, type Session } from '@/lib/session-server';
import { getOrCreateGuestUser } from '@/lib/db/queries';
import type { User } from '@/lib/db/schema';

export interface SimpleAuth {
  user: User;
  session: Session;
}

export async function auth(): Promise<SimpleAuth | null> {
  const session = await getOrCreateSession();
  if (!session) {
    return null;
  }

  const user = await getOrCreateGuestUser(session.userId);

  return {
    user,
    session,
  };
}
