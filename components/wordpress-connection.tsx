'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { validateWordPressConnection } from '@/lib/mcp/client';
import { toast } from '@/components/toast';

interface WordPressConnectionProps {
  onConnectionChange?: (connected: boolean, siteUrl?: string) => void;
}

export function WordPressConnection({
  onConnectionChange,
}: WordPressConnectionProps) {
  const [mode, setMode] = useState<'basic' | 'plugin'>('basic');
  const [siteUrl, setSiteUrl] = useState('');
  const [jwtToken, setJwtToken] = useState('');
  const [writeMode, setWriteMode] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [pluginVersion, setPluginVersion] = useState<string | null>(null);
  const [toolsCount, setToolsCount] = useState<number | null>(null);
  const [compatIssue, setCompatIssue] = useState<string | null>(null);

  // Load saved connection state on mount
  useEffect(() => {
    const checkConnection = async () => {
      const response = await fetch('/api/mcp/connection/status', {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.connected);
        setSiteUrl(data.siteUrl || '');
        setWriteMode(data.writeMode || false);
        onConnectionChange?.(data.connected, data.siteUrl);
      }
    };

    checkConnection();
  }, [onConnectionChange]);

  const handleConnect = async () => {
    if (!siteUrl || !jwtToken) {
      setConnectionError('Please enter both Site URL and JWT Token');
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Validate the connection (MCP initialize)
      const validate = await validateWordPressConnection(siteUrl, jwtToken);
      const isValid = !!validate?.valid;
      const compat = validate?.compat;
      const mcpResult = validate?.mcpResponse;
      const tools = mcpResult?.capabilities?.tools || [];
      setPluginVersion(
        mcpResult?.serverInfo?.version || mcpResult?.pluginVersion || null,
      );
      setToolsCount(Array.isArray(tools) ? tools.length : null);
      setCompatIssue(
        compat?.ok ? null : compat?.reason || 'Incompatible plugin',
      );

      if (!isValid) {
        throw new Error('Failed to connect to WordPress');
      }

      // If user selected Plugin mode, also try a lightweight health probe for our WP Cursor plugin
      if (mode === 'plugin') {
        try {
          const probe = await fetch('/api/mcp/plugin/health', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteUrl }),
          });
          if (probe.ok) {
            const data = await probe.json();
            if (data?.pluginVersion && !pluginVersion) {
              setPluginVersion(String(data.pluginVersion));
            }
          }
        } catch {}
      }

      // Save connection details
      const response = await fetch('/api/mcp/connection/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteUrl,
          jwtToken,
          writeMode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save connection');
      }

      setIsConnected(true);
      onConnectionChange?.(true, siteUrl);

      toast({
        type: 'success',
        description: 'Successfully connected to WordPress',
      });

      // Load available tools
      await loadTools();
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : 'Connection failed',
      );
      setIsConnected(false);
      onConnectionChange?.(false);

      toast({
        type: 'error',
        description: 'Failed to connect to WordPress',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch('/api/mcp/connection/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setIsConnected(false);
        setSiteUrl('');
        setJwtToken('');
        setWriteMode(false);
        onConnectionChange?.(false);

        toast({
          type: 'success',
          description: 'Disconnected from WordPress',
        });
      }
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to disconnect',
      });
    }
  };

  const loadTools = async () => {
    try {
      const metaResp = await fetch('/api/mcp/connection/meta');
      const meta = metaResp.ok ? await metaResp.json() : {};
      const currentHash = meta?.toolsHash || null;
      const cachedHash =
        typeof window !== 'undefined'
          ? localStorage.getItem('wp_tools_hash_cache')
          : null;
      if (currentHash && currentHash !== cachedHash) {
        localStorage.setItem('wp_tools_hash_cache', currentHash);
        localStorage.removeItem('wp_tools_cached');
      }

      const cached =
        typeof window !== 'undefined'
          ? localStorage.getItem('wp_tools_cached')
          : null;

      if (cached) {
        const parsed = JSON.parse(cached);
        setToolsCount(Array.isArray(parsed) ? parsed.length : null);
        return;
      }

      const response = await fetch('/api/mcp/tools/list', { method: 'POST' });

      if (response.ok) {
        const data = await response.json();
        console.log('Available WordPress tools:', data.tools);
        try {
          localStorage.setItem('wp_tools_cached', JSON.stringify(data.tools));
        } catch {}
        setToolsCount(Array.isArray(data.tools) ? data.tools.length : null);
      }
    } catch (error) {
      console.error('Failed to load tools:', error);
    }
  };

  const handleWriteModeToggle = async (enabled: boolean) => {
    setWriteMode(enabled);

    if (isConnected) {
      try {
        await fetch('/api/mcp/connection/write-mode', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ enabled }),
        });

        toast({
          type: 'info',
          description: `Write mode ${enabled ? 'enabled' : 'disabled'}`,
        });
      } catch (error) {
        console.error('Failed to update write mode:', error);
      }
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-gray-400" />
          )}
          WordPress Connection
        </CardTitle>
        <CardDescription>
          Choose how to connect: Basic MCP or our WP Cursor plugin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection mode toggle */}
        <div className="flex w-full rounded-lg border overflow-hidden">
          <button
            type="button"
            className={`flex-1 px-3 py-2 text-sm ${
              mode === 'basic'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted'
            }`}
            onClick={() => setMode('basic')}
            disabled={isConnected}
          >
            Basic MCP Connection
          </button>
          <button
            type="button"
            className={`flex-1 px-3 py-2 text-sm border-l ${
              mode === 'plugin'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted'
            }`}
            onClick={() => setMode('plugin')}
            disabled={isConnected}
          >
            Plugin Connection
          </button>
        </div>

        {mode === 'plugin' && !isConnected && (
          <div className="p-3 rounded-md border bg-muted/40 text-sm">
            <div className="font-medium mb-1">WP Cursor plugin</div>
            <p className="text-muted-foreground">
              Use our WordPress plugin for richer MCP tools and signed audit
              logs. Install it on your site from the repo under
              <span className="font-mono"> plugins/wp-cursor </span> and
              activate it. Then issue a JWT token from the plugin admin page.
            </p>
          </div>
        )}

        {!isConnected ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="site-url">Site URL</Label>
              <Input
                id="site-url"
                type="url"
                placeholder="https://your-site.com"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                disabled={isConnecting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jwt-token">{mode === 'plugin' ? 'JWT Token (WP Cursor)' : 'JWT Token'}</Label>
              <div className="flex gap-2">
                <Input
                  id="jwt-token"
                  type={showToken ? 'text' : 'password'}
                  placeholder="Enter your JWT token"
                  value={jwtToken}
                  onChange={(e) => setJwtToken(e.target.value)}
                  disabled={isConnecting}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? 'Hide' : 'Show'}
                </Button>
              </div>
              {mode === 'basic' ? (
                <p className="text-xs text-muted-foreground">
                  Generate a JWT token from WordPress Admin → Settings →
                  WordPress MCP (Automattic plugin)
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Issue a JWT from WP Admin → Tools → WP Cursor → Issue Token
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="write-mode"
                  checked={writeMode}
                  onCheckedChange={handleWriteModeToggle}
                  disabled={isConnecting}
                />
                <Label htmlFor="write-mode" className="cursor-pointer">
                  Enable Write Mode
                </Label>
              </div>
              {writeMode && (
                <span className="text-xs text-yellow-600 dark:text-yellow-400">
                  ⚠️ Allows content modification
                </span>
              )}
            </div>

            {connectionError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{connectionError}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleConnect}
              disabled={isConnecting || !siteUrl || !jwtToken}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect to WordPress'
              )}
            </Button>
          </>
        ) : (
          <>
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription>
                Connected to <strong>{siteUrl}</strong>
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-2">
                <Switch
                  id="write-mode-connected"
                  checked={writeMode}
                  onCheckedChange={handleWriteModeToggle}
                />
                <Label
                  htmlFor="write-mode-connected"
                  className="cursor-pointer"
                >
                  Write Mode
                </Label>
              </div>
              <span
                className={`text-xs font-medium ${writeMode ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}`}
              >
                {writeMode ? '✏️ Enabled' : '👁️ Read-only'}
              </span>
            </div>

            {(pluginVersion || toolsCount !== null) && (
              <div className="p-3 border rounded-lg bg-background">
                <div className="text-sm flex gap-4">
                  {pluginVersion && (
                    <span>
                      Plugin v<strong>{pluginVersion}</strong>
                    </span>
                  )}
                  {toolsCount !== null && (
                    <span>
                      Tools: <strong>{toolsCount}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            {compatIssue && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {compatIssue}. Please update the WP Cursor plugin on your
                  site. Refer to Settings → Plugins or download the latest ZIP
                  from your account.
                </AlertDescription>
              </Alert>
            )}

            {writeMode && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Write mode is enabled. The AI can create, update, and delete
                  content on your WordPress site.
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleDisconnect}
              variant="outline"
              className="w-full"
            >
              Disconnect
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
