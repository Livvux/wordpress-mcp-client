'use client';

import Link from 'next/link';
import { AccountModal } from '@/components/account-modal';
import { AuthModal } from '@/components/auth-modal';
import {
  Sun,
  Moon,
  User,
  LogOut,
  Settings,
  CreditCard,
  Shield,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useSession } from '@/lib/auth-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

export function SidebarUserNav() {
  const { setTheme, resolvedTheme } = useTheme();
  const { session } = useSession();
  const isGuest = !session || session.userType === 'guest';

  const displayEmail = session?.email || null;
  // For guest sessions, do NOT use any provided name like "Guest User";
  // let the UI fallback render a friendlier label ("Welcome").
  const displayName = isGuest
    ? null
    : session?.user?.name || (displayEmail ? displayEmail.split('@')[0] : null);
  const initials = (displayName || displayEmail || 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Show Admin entry only for owner/admin roles
  const roles = (session as any)?.roles || (session as any)?.user?.roles || [];
  const isAdmin = Array.isArray(roles)
    ? roles.includes('admin') || roles.includes('owner')
    : false;

  async function handleSignOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // hard reload to ensure middleware sees cleared cookie
      window.location.href = '/';
    } catch (e) {
      window.location.href = '/';
    }
  }

  return (
    <SidebarMenu>
      {/* Avatar + inline summary as one trigger */}
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              data-testid="user-nav-button"
              className="h-9 px-2 justify-start gap-2"
              aria-label="Open user menu"
            >
              <div className="h-8 w-8 rounded-full bg-sidebar-accent-foreground/10 flex items-center justify-center text-xs font-medium shrink-0">
                {isGuest ? <User className="size-4" /> : initials}
              </div>
              <div className="flex min-w-0 items-center gap-1">
                <span className="text-sm font-medium truncate">
                  {displayName || (isGuest ? 'Welcome' : 'User')}
                </span>
                <span
                  className="text-xs text-sidebar-foreground/60 truncate"
                  data-testid="user-email"
                >
                  {displayEmail || 'Guest'}
                </span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="end"
            sideOffset={6}
            data-testid="user-nav-menu"
          >
            {isGuest ? (
              <>
                <DropdownMenuLabel>Welcome</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild data-testid="user-nav-item-auth">
                  <AuthModal
                    mode="login"
                    allowSwitch
                    trigger={
                      <button type="button" className="w-full text-left text-sm font-light px-2 py-1.5">
                        Login or Register
                      </button>
                    }
                  />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                  }
                >
                  {resolvedTheme === 'dark' ? (
                    <Sun className="size-4" />
                  ) : (
                    <Moon className="size-4" />
                  )}
                  <span>Theme</span>
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuLabel className="max-w-[220px] truncate">
                  {displayName || 'User'}
                </DropdownMenuLabel>
                {displayEmail && (
                  <DropdownMenuItem
                    className="text-xs text-muted-foreground cursor-default"
                    disabled
                  >
                    {displayEmail}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {/* Use DropdownMenuItem as the actual trigger to inherit consistent sizing */}
                <AccountModal
                  trigger={
                    <DropdownMenuItem>
                      <Settings className="size-4" />
                      <span>Account</span>
                    </DropdownMenuItem>
                  }
                />
                <DropdownMenuItem asChild>
                  <Link href="/billing" className="flex items-center gap-2">
                    <CreditCard className="size-4" />
                    <span>Billing</span>
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="flex items-center gap-2">
                      <Shield className="size-4" />
                      <span>Admin</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                  }
                >
                  {resolvedTheme === 'dark' ? (
                    <Sun className="size-4" />
                  ) : (
                    <Moon className="size-4" />
                  )}
                  <span>Theme</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild data-testid="user-nav-item-auth">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-red-600"
                  >
                    <LogOut className="size-4" />
                    <span>Sign out</span>
                  </button>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
