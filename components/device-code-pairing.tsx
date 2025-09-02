'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CopyButton } from '@/components/copy-button';
import { Loader2, Link as LinkIcon, QrCode } from 'lucide-react';
import { AuthModal } from '@/components/auth-modal';

interface DeviceCodePairingProps {
  onPaired?: (siteUrl: string) => void;
}

export function DeviceCodePairing({ onPaired }: DeviceCodePairingProps) {
  const [started, setStarted] = useState(false);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [status, setStatus] = useState<
    'idle' | 'pending' | 'approved' | 'expired' | 'error' | 'login_required'
  >('idle');
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const start = async () => {
    setError(null);
    setStatus('pending');
    try {
      const res = await fetch('/api/mcp/connection/device/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to start pairing');
      const data = await res.json();
      setUserCode(String(data.user_code));
      setDeviceCode(String(data.device_code));
      setExpiresIn(Number(data.expires_in || 600));
      setStarted(true);
      poll(String(data.device_code), Number(data.interval || 5));
      // countdown
      timerRef.current = setInterval(() => {
        setExpiresIn((s) => (s > 0 ? s - 1 : 0));
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start pairing');
      setStatus('error');
    }
  };

  const poll = async (code: string, interval: number) => {
    const tick = async () => {
      try {
        const res = await fetch('/api/mcp/connection/device/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_code: code }),
          cache: 'no-store',
        });
        if (res.status === 402) {
          const data = await res.json().catch(() => ({}) as any);
          setError(
            data?.message ||
              'Free plan supports only 1 connected site. Upgrade to add more.',
          );
          setStatus('error');
          return;
        }
        if (!res.ok) throw new Error('Polling failed');
        const data = await res.json();
        if (data.status === 'pending') return; // keep polling
        if (data.status === 'expired') {
          setStatus('expired');
          if (timerRef.current) clearInterval(timerRef.current);
          return;
        }
        if (data.status === 'approved_requires_login') {
          setStatus('login_required');
          return;
        }
        if (data.status === 'approved') {
          setStatus('approved');
          setSiteUrl(String(data.siteUrl || ''));
          if (timerRef.current) clearInterval(timerRef.current);
          onPaired?.(String(data.siteUrl || ''));
          return;
        }
        if (data.status === 'consumed') {
          setStatus('approved');
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Polling error');
        setStatus('error');
      }
    };
    const id = setInterval(tick, Math.max(3, interval) * 1000);
    // run immediately too
    tick();
  };

  const appUrl =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pair via Device Code</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!started ? (
          <>
            <div className="text-sm text-muted-foreground">
              Don’t want to paste tokens? Generate a short code and approve the
              link in your WordPress admin (Tools → WP Cursor → Pair with App).
            </div>
            <Button onClick={start} data-testid="device-get-code">
              Get Pairing Code
            </Button>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="text-sm">Enter this code in your WP admin:</div>
            <div className="flex items-center gap-2">
              <code
                data-testid="device-user-code"
                className="px-2 py-1 rounded bg-zinc-100 text-lg font-mono"
              >
                {userCode}
              </code>
              <CopyButton text={userCode || ''} variant="outline">
                Copy
              </CopyButton>
            </div>
            <div className="text-xs text-muted-foreground">
              App URL for the plugin form:
            </div>
            <div className="flex items-center gap-2">
              <code className="px-2 py-1 rounded bg-zinc-100 text-xs break-all">
                {appUrl}
              </code>
              <CopyButton text={appUrl} variant="outline">
                Copy
              </CopyButton>
            </div>
            <div className="text-xs text-muted-foreground">
              Expires in {expiresIn}s
            </div>

            {status === 'pending' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Waiting for
                approval…
              </div>
            )}
            {status === 'login_required' && (
              <div className="space-y-2">
                <Alert>
                  <AlertDescription>
                    Approved in plugin. Please sign in here to complete linking.
                  </AlertDescription>
                </Alert>
                <div>
                  <AuthModal
                    mode="login"
                    allowSwitch
                    trigger={
                      <Button data-testid="device-login-cta">Sign in</Button>
                    }
                  />
                </div>
              </div>
            )}
            {status === 'approved' && (
              <Alert>
                <AlertDescription>
                  Paired successfully{siteUrl ? ` with ${siteUrl}` : ''}.
                </AlertDescription>
              </Alert>
            )}
            {status === 'expired' && (
              <Alert variant="destructive">
                <AlertDescription>
                  Code expired. Generate a new one.
                </AlertDescription>
              </Alert>
            )}
            {status === 'error' && error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {error}{' '}
                  <a
                    href="/upgrade"
                    className="underline"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = '/upgrade';
                    }}
                  >
                    Upgrade
                  </a>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
