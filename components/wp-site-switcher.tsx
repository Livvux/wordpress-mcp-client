'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDownIcon, CheckCircleFillIcon, PlusIcon } from './icons';
import Link from 'next/link';
import type { Session } from '@/lib/session';
import { toast } from './toast';
import { SettingsModal } from './settings-modal';

interface SiteItem {
  siteUrl: string;
  writeMode: boolean;
  updatedAt?: string | Date;
  lastUsedAt?: string | Date | null;
  isActive?: boolean;
}

function hostFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

export function WPSiteSwitcher({
  session,
  className,
}: {
  session: Session;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [loading, setLoading] = useState(false);

  const isLoggedIn = (session?.user?.type || session?.userType) === 'regular';

  useEffect(() => {
    if (!isLoggedIn) return;
    let ignore = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/mcp/connection/list', {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          if (!ignore)
            setSites(Array.isArray(data.connections) ? data.connections : []);
        }
      } catch {}
      setLoading(false);
    };
    load();
    return () => {
      ignore = true;
    };
  }, [isLoggedIn]);

  const active = useMemo(() => sites.find((s) => s.isActive), [sites]);
  const activeLabel = active ? hostFromUrl(active.siteUrl) : 'Select Site';

  async function selectSite(siteUrl: string) {
    try {
      const res = await fetch('/api/mcp/connection/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl }),
      });
      if (!res.ok) {
        const msg =
          (await res.json().catch(() => ({})))?.error ||
          'Failed to switch site';
        toast({ type: 'error', description: msg });
        return;
      }
      toast({
        type: 'success',
        description: `Active site: ${hostFromUrl(siteUrl)}`,
      });
      // Optimistically update active flag
      setSites((prev) =>
        prev.map((s) => ({ ...s, isActive: s.siteUrl === siteUrl })),
      );
    } catch (e) {
      toast({ type: 'error', description: 'Failed to switch site' });
    }
  }

  if (!isLoggedIn) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={className}
          data-testid="wp-site-switcher"
        >
          {loading ? 'Loading…' : activeLabel}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[280px]">
        {sites.length === 0 ? (
          <DropdownMenuItem asChild>
            <span className="text-sm text-muted-foreground">
              No sites connected
            </span>
          </DropdownMenuItem>
        ) : (
          sites.map((site) => (
            <DropdownMenuItem
              key={site.siteUrl}
              onSelect={() => {
                setOpen(false);
                selectSite(site.siteUrl);
              }}
              data-active={site.isActive}
              asChild
            >
              <button
                type="button"
                className="gap-3 group/item flex flex-row justify-between items-center w-full"
              >
                <div className="flex flex-col items-start">
                  <div>{hostFromUrl(site.siteUrl)}</div>
                  <div className="text-xs text-muted-foreground">
                    {site.writeMode ? 'Write enabled' : 'Read-only'}
                  </div>
                </div>
                <div className="opacity-0 group-data-[active=true]/item:opacity-100">
                  <CheckCircleFillIcon />
                </div>
              </button>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <SettingsModal
          trigger={
            <DropdownMenuItem
              asChild
              onSelect={(e) => {
                // Prevent the dropdown from closing immediately,
                // which unmounts the modal right after it opens.
                e.preventDefault();
              }}
            >
              <button type="button" className="flex items-center gap-2 w-full">
                <PlusIcon />
                <span>Add or Manage Sites…</span>
              </button>
            </DropdownMenuItem>
          }
          onConnectionChange={(connected: boolean, siteUrl?: string) => {
            const currentlyActiveUrl = active?.siteUrl || '';
            const currentlyConnected = Boolean(currentlyActiveUrl);

            // Only refetch if connection status or active site actually changed
            const statusChanged = connected !== currentlyConnected;
            const siteChanged = siteUrl && siteUrl !== currentlyActiveUrl;
            if (!statusChanged && !siteChanged) return;

            (async () => {
              try {
                const res = await fetch('/api/mcp/connection/list', {
                  cache: 'no-store',
                });
                if (res.ok) {
                  const data = await res.json();
                  setSites(
                    Array.isArray(data.connections) ? data.connections : [],
                  );
                }
              } catch {}
            })();
          }}
          siteUrl={active?.siteUrl || ''}
        />
        <DropdownMenuItem asChild>
          <Link href="/admin/wp-plugin" className="w-full text-left">
            WordPress Plugin Onboarding…
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
