'use client';

import { deleteBrowserSession } from '@/lib/session';
import { useRouter } from 'next/navigation';

export const SignOutForm = () => {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      // Clear server session cookie
      await fetch('/api/auth/logout', { method: 'POST' });
      // Clear browser session
      deleteBrowserSession();
      // Hard reload to ensure middleware pathing is correct
      window.location.href = '/';
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="w-full text-left px-1 py-0.5 text-red-500"
    >
      Sign out
    </button>
  );
};
