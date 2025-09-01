import { nanoid } from 'nanoid';

const SESSION_COOKIE_NAME = 'mcp_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type UserType = 'guest' | 'regular';

export interface Session {
  id: string;
  userId: string;
  userType: UserType;
  email?: string;
  createdAt: Date;
  user: User; // NextAuth-compatible user object
}

// NextAuth-compatible User interface for component compatibility
export interface User {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  type?: UserType;
}

export interface BrowserSession extends Session {
  // Client-side session data that can be stored in browser storage
  isClientSession?: boolean;
}

// Server-side session utilities moved to `lib/session-server.ts`

// Browser-side session utilities (for client components)
export function createBrowserSession(
  userType: UserType = 'guest',
  email?: string,
): BrowserSession {
  const userId = userType === 'guest' ? `guest_${nanoid()}` : nanoid();
  const user: User = {
    id: userId,
    email: email || null,
    name: userType === 'guest' ? `Guest User` : email?.split('@')[0] || 'User',
    image: null,
    type: userType,
  };

  const session: BrowserSession = {
    id: nanoid(),
    userId,
    userType,
    email,
    createdAt: new Date(),
    user,
    isClientSession: true,
  };

  try {
    // Store in sessionStorage for tab-specific sessions
    sessionStorage.setItem('mcp_session', JSON.stringify(session));
    // Also store in localStorage as fallback for session recovery
    localStorage.setItem('mcp_session_backup', JSON.stringify(session));
  } catch (error) {
    console.warn('Failed to store session in browser storage:', error);
  }

  return session;
}

export function getBrowserSession(): BrowserSession | null {
  if (typeof window === 'undefined') return null;

  try {
    // First try sessionStorage (tab-specific)
    let sessionData = sessionStorage.getItem('mcp_session');

    // Fall back to localStorage if sessionStorage is empty
    if (!sessionData) {
      sessionData = localStorage.getItem('mcp_session_backup');
      // If we found a backup, restore it to sessionStorage
      if (sessionData) {
        sessionStorage.setItem('mcp_session', sessionData);
      }
    }

    if (!sessionData) return null;

    const session = JSON.parse(sessionData);

    // Ensure user object exists (backward compatibility)
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
      };
    }

    return {
      ...session,
      createdAt: new Date(session.createdAt),
      isClientSession: true,
    };
  } catch (error) {
    console.warn('Failed to get session from browser storage:', error);
    return null;
  }
}

export function deleteBrowserSession(): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem('mcp_session');
    localStorage.removeItem('mcp_session_backup');
  } catch (error) {
    console.warn('Failed to delete session from browser storage:', error);
  }
}

export function getOrCreateBrowserSession(): BrowserSession {
  const session = getBrowserSession();
  if (session) {
    return session;
  }
  return createBrowserSession();
}

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
