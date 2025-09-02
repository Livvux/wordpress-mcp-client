import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/app/(auth)/auth';
import { computeUserRoles, hasOwnerOrAdmin } from '@/lib/rbac';
import Link from 'next/link';

export const metadata = {
  title: 'Admin',
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login?next=/admin');
  }

  const roles =
    session.user.roles ||
    (await computeUserRoles({
      userId: session.user.id,
      email: session.user.email ?? null,
    }));

  if (!(await hasOwnerOrAdmin(roles))) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-black text-white flex items-center justify-center text-xs font-bold">
              ADM
            </div>
            <div className="text-sm text-zinc-600">Admin Dashboard</div>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-zinc-700 hover:text-black">
              Übersicht
            </Link>
            <Link
              href="/admin/ai-config"
              className="text-zinc-700 hover:text-black"
            >
              Global AI
            </Link>
            <Link
              href="/admin/wp-plugin"
              className="text-zinc-700 hover:text-black"
            >
              WP Plugin
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
