import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';
import type { BrowserSession, Session, User, UserType } from './session';
import { computeUserRoles } from '@/lib/rbac';
import { encryptSecret, decryptSecret } from '@/lib/crypto';

const SESSION_COOKIE_NAME = 'mcp_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type { Session, User, UserType, BrowserSession };

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie) {
    return null;
  }

  try {
    let raw = sessionCookie.value;
    let session: any = null;
    try {
      session = JSON.parse(raw);
    } catch {
      try {
        const decrypted = decryptSecret(raw);
        session = JSON.parse(decrypted);
      } catch {
        session = null;
      }
    }

    // Validate essential fields; if corrupted or missing, force new session
    if (
      !session ||
      typeof session.userId !== 'string' ||
      session.userId.length === 0
    ) {
      return null;
    }

    if (!session.user) {
      session.user = {
        id: session.userId,
        email: session.email || null,
        name:
          session.userType === 'guest'
            ? `Guest User`
            : session.email?.split('@')[0] || 'User',
        image: null,
        type: session.userType,
      } as User;
    }

    const enriched: Session = {
      ...session,
      createdAt: new Date(session.createdAt),
    } as Session;

    try {
      const roles = await computeUserRoles({
        userId: enriched.userId,
        email: enriched.email || null,
      });
      enriched.roles = roles;
      if (enriched.user) {
        enriched.user.roles = roles;
      }
    } catch (_) {
      // ignore role enrichment failures
    }

    return enriched;
  } catch {
    return null;
  }
}

export async function createSession(
  userType: UserType = 'guest',
  email?: string,
): Promise<Session> {
  const userId = userType === 'guest' ? `guest_${nanoid()}` : nanoid();
  const user: User = {
    id: userId,
    email: email || null,
    name: userType === 'guest' ? `Guest User` : email?.split('@')[0] || 'User',
    image: null,
    type: userType,
  };

  const session: Session = {
    id: nanoid(),
    userId,
    userType,
    email,
    createdAt: new Date(),
    user,
  };

  const cookieStore = await cookies();
  const payload = encryptSecret(JSON.stringify(session));
  cookieStore.set(SESSION_COOKIE_NAME, payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  return session;
}

export async function getOrCreateSession(): Promise<Session> {
  const session = await getSession();
  if (session) {
    return session;
  }
  return createSession();
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// Create a session for an existing DB user (preserve DB user id)
export async function createSessionForUser(
  userId: string,
  userType: UserType,
  email: string,
): Promise<Session> {
  const user: User = {
    id: userId,
    email,
    name: email.split('@')[0] || 'User',
    image: null,
    type: userType,
  };

  const session: Session = {
    id: nanoid(),
    userId,
    userType,
    email,
    createdAt: new Date(),
    user,
  };

  const cookieStore = await cookies();
  const payload = encryptSecret(JSON.stringify(session));
  cookieStore.set(SESSION_COOKIE_NAME, payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  return session;
}

// Utilities shared between server and client
export function sessionToUser(
  session: Session | BrowserSession | null,
): User | null {
  if (!session) return null;

  return {
    id: session.userId,
    email: session.email || null,
    name:
      session.userType === 'guest'
        ? `Guest User`
        : session.email?.split('@')[0] || 'User',
    image: null,
    type: session.userType,
  };
}

export function sessionToNextAuthSession(
  session: Session | BrowserSession | null,
): { user: User } | null {
  if (!session) return null;

  const user = sessionToUser(session);
  if (!user) return null;

  return { user };
}
