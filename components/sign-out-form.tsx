'use client';

import { deleteBrowserSession } from '@/lib/session';
import { useRouter } from 'next/navigation';

export const SignOutForm = () => {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      // Clear browser session
      deleteBrowserSession();

      // Redirect to home and refresh to create new session
      router.push('/');
      router.refresh();
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
