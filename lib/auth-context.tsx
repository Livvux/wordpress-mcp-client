'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  type Session,
  type User,
  getBrowserSession,
  createBrowserSession,
} from './session';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  update: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = async () => {
    try {
      // Try to read authoritative server session first
      const res = await fetch('/api/session', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const serverSession = data?.session ?? null;
        if (serverSession) {
          setSession({
            ...serverSession,
            createdAt: new Date(serverSession.createdAt),
          });
          setLoading(false);
          return;
        }
      }

      // Fallback to browser session
      let browserSession = getBrowserSession();
      if (!browserSession) browserSession = createBrowserSession();
      setSession(browserSession);
    } catch (error) {
      console.error('Failed to load session:', error);
      const fallbackSession = createBrowserSession();
      setSession(fallbackSession);
    } finally {
      setLoading(false);
    }
  };

  const update = async () => {
    await loadSession();
  };

  useEffect(() => {
    loadSession();
  }, []);

  const user = session?.user || null;

  return (
    <AuthContext.Provider value={{ session, user, loading, update }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSession() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSession must be used within an AuthProvider');
  }
  return context;
}

// Alias for NextAuth compatibility
export const SessionProvider = AuthProvider;
