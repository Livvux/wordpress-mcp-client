import { auth } from '@/app/(auth)/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { CopyButton } from '@/components/copy-button';

function getOriginFromHeaders(headers: Headers) {
  const host = headers.get('x-forwarded-host') || headers.get('host');
  const proto = headers.get('x-forwarded-proto') || 'http';
  if (!host) return null;
  return `${proto}://${host}`.replace(/\/$/, '');
}

async function ConnectionStatus() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/mcp/connection/status`, {
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({ connected: false }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Current Connection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div>
          <span className="text-zinc-500">Status: </span>
          <span className={data.connected ? 'text-green-600' : 'text-zinc-700'}>
            {data.connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
        {data.siteUrl && (
          <div>
            <span className="text-zinc-500">Site: </span>
            <span className="break-all">{data.siteUrl}</span>
          </div>
        )}
        <div>
          <span className="text-zinc-500">Write mode: </span>
          <span>{data.writeMode ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div className="pt-2">
          <Link href="/settings/integrations/wordpress" className="text-xs underline">
            Manage connection
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function WPPluginOnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    // Admin layout already gates, but add a helpful prompt for direct access
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">WP Cursor Plugin</h1>
        <Alert>
          <AlertDescription>
            Please sign in to connect your WordPress site to your account.
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link href={`/login?next=/admin/wp-plugin`}>Sign in</Link>
        </Button>
      </div>
    );
  }

  const originEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const originRuntime = originEnv || getOriginFromHeaders((await headers()) as unknown as Headers) || '';
  const zipUrl = '/releases/wp-cursor-0.1.0.zip';
  const updatesUrl = `${originRuntime}/updates.json`;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">WP Cursor Plugin</h1>
        <p className="text-sm text-zinc-600">
          Download the plugin and connect your WordPress site without manually entering tokens.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Step 1 — Download</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">Get the latest WP Cursor plugin ZIP and install it in your WordPress admin.</div>
            <div className="flex items-center gap-2">
              <Button asChild>
                <a href={zipUrl} download>
                  Download WP Cursor (v0.1.0)
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={updatesUrl} target="_blank" rel="noreferrer">
                  View updates.json
                </a>
              </Button>
            </div>
            <div className="text-xs text-zinc-500">
              WordPress → Plugins → Add New → Upload Plugin → Choose File → Install Now → Activate
            </div>
          </CardContent>
        </Card>

        <Suspense fallback={<Card><CardHeader><CardTitle className="text-base">Connection</CardTitle></CardHeader><CardContent>Loading…</CardContent></Card>}>
          {/* @ts-expect-error Async Server Component */}
          <ConnectionStatus />
        </Suspense>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 2 — Connect via Plugin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            In your WordPress admin, go to Tools → WP Cursor → Connect to App. Use this App URL:
          </div>
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 rounded bg-zinc-100 text-xs break-all">{originRuntime || 'http://localhost:3000'}</code>
            <CopyButton variant="outline" text={originRuntime || 'http://localhost:3000'}>
              Copy
            </CopyButton>
          </div>
          <div className="text-xs text-zinc-500">
            The plugin will redirect back here and your connection will be saved to your account.
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertDescription>
          Note: Linking only works when you are signed in. Connections are saved to your account and persist across sessions.
        </AlertDescription>
      </Alert>
    </div>
  );
}
