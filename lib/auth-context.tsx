'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
      // First try to get browser session
      let browserSession = getBrowserSession();
      
      // If no browser session exists, create one
      if (!browserSession) {
        browserSession = createBrowserSession();
      }
      
      setSession(browserSession);
    } catch (error) {
      console.error('Failed to load session:', error);
      // Create a fallback session
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