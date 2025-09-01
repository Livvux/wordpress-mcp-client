'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { validateWordPressConnection } from '@/lib/mcp/client';
import { toast } from '@/components/toast';

interface WordPressConnectionProps {
  onConnectionChange?: (connected: boolean, siteUrl?: string) => void;
}

export function WordPressConnection({ onConnectionChange }: WordPressConnectionProps) {
  const [siteUrl, setSiteUrl] = useState('');
  const [jwtToken, setJwtToken] = useState('');
  const [writeMode, setWriteMode] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

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
      // Validate the connection
      const isValid = await validateWordPressConnection(siteUrl, jwtToken);
      
      if (!isValid) {
        throw new Error('Failed to connect to WordPress');
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
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
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
      const response = await fetch('/api/mcp/tools/list', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Available WordPress tools:', data.tools);
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
          Connect to your WordPress site using the WordPress MCP plugin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
              <Label htmlFor="jwt-token">JWT Token</Label>
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
              <p className="text-xs text-muted-foreground">
                Generate a JWT token from WordPress Admin → Settings → WordPress MCP
              </p>
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
                <Label htmlFor="write-mode-connected" className="cursor-pointer">
                  Write Mode
                </Label>
              </div>
              <span className={`text-xs font-medium ${writeMode ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}`}>
                {writeMode ? '✏️ Enabled' : '👁️ Read-only'}
              </span>
            </div>

            {writeMode && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Write mode is enabled. The AI can create, update, and delete content on your WordPress site.
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