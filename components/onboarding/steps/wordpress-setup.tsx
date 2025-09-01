'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Wifi, WifiOff, Eye, EyeOff, ExternalLinkIcon } from 'lucide-react';
import { validateWordPressConnection } from '@/lib/mcp/client';

interface WordPressSetupProps {
  siteUrl: string;
  jwtToken: string;
  writeMode: boolean;
  onSiteUrlChange: (url: string) => void;
  onJwtTokenChange: (token: string) => void;
  onWriteModeChange: (enabled: boolean) => void;
  onValidationChange: (isValid: boolean) => void;
}

export function WordPressSetup({
  siteUrl,
  jwtToken,
  writeMode,
  onSiteUrlChange,
  onJwtTokenChange,
  onWriteModeChange,
  onValidationChange,
}: WordPressSetupProps) {
  const [showToken, setShowToken] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState(false);

  useEffect(() => {
    setConnectionError(null);
    setConnectionSuccess(false);
    onValidationChange(false);
  }, [siteUrl, jwtToken, onValidationChange]);

  const validateConnection = async () => {
    if (!siteUrl || !jwtToken) {
      setConnectionError('Please enter both Site URL and JWT Token');
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);
    setConnectionSuccess(false);

    try {
      const isValid = await validateWordPressConnection(siteUrl, jwtToken);
      
      if (!isValid) {
        throw new Error('Failed to connect to WordPress site');
      }

      setConnectionSuccess(true);
      onValidationChange(true);
    } catch (error) {
      let errorMessage = 'Connection failed';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Add some user-friendly context to common errors
      if (errorMessage.includes('404')) {
        errorMessage += '\n\nThe WordPress MCP plugin endpoint was not found. Make sure the plugin is installed and activated.';
      } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
        errorMessage += '\n\nAuthentication failed. Check if your JWT token is valid and not expired.';
      } else if (errorMessage.includes('Network error') || errorMessage.includes('ENOTFOUND')) {
        errorMessage += '\n\nPlease verify the WordPress site URL is correct and accessible from the internet.';
      }
      
      setConnectionError(errorMessage);
      onValidationChange(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const canValidate = siteUrl && jwtToken && !isConnecting;
  const isConnectionComplete = connectionSuccess && siteUrl && jwtToken;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Connect Your WordPress Site</h2>
        <p className="text-muted-foreground">
          Connect to your WordPress site using the{' '}
          <a 
            href="https://github.com/Automattic/wordpress-mcp/releases/download/v0.2.5/wordpress-mcp.zip"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            WordPress MCP Plugin
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {connectionSuccess ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-gray-400" />
            )}
            <span>WordPress Connection</span>
            {connectionSuccess && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          </CardTitle>
          <CardDescription>
            You&apos;ll need the WordPress MCP plugin installed and configured on your site
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="site-url">Site URL</Label>
            <Input
              id="site-url"
              type="url"
              placeholder="https://your-site.com"
              value={siteUrl}
              onChange={(e) => onSiteUrlChange(e.target.value)}
              disabled={isConnecting}
              className={connectionSuccess ? 'border-green-500' : ''}
            />
            <p className="text-xs text-muted-foreground">
              The full URL to your WordPress site including https://
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jwt-token">JWT Token</Label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Input
                  id="jwt-token"
                  type={showToken ? 'text' : 'password'}
                  placeholder="Enter your JWT token"
                  value={jwtToken}
                  onChange={(e) => onJwtTokenChange(e.target.value)}
                  disabled={isConnecting}
                  className={connectionSuccess ? 'border-green-500' : ''}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Generate a JWT token from WordPress Admin → Settings → WordPress MCP
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center space-x-2">
                <Switch
                  id="write-mode"
                  checked={writeMode}
                  onCheckedChange={onWriteModeChange}
                  disabled={isConnecting}
                />
                <Label htmlFor="write-mode" className="cursor-pointer font-medium">
                  Enable Write Mode
                </Label>
              </div>
              <div className="text-right">
                <span className={`text-xs font-medium ${writeMode ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                  {writeMode ? '✏️ Write Enabled' : '👁️ Read Only'}
                </span>
              </div>
            </div>
            
            {writeMode && (
              <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  Write mode allows the AI to create, update, and delete content on your WordPress site. 
                  Only enable this if you trust the AI to make changes to your site.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Button
            onClick={validateConnection}
            disabled={!canValidate}
            className="w-full"
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Connection...
              </>
            ) : (
              'Test WordPress Connection'
            )}
          </Button>

          {connectionError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div>{connectionError}</div>
                  <div className="text-sm">
                    <strong>Common issues:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Make sure the WordPress MCP plugin is installed and activated</li>
                      <li>Verify the JWT token was generated correctly</li>
                      <li>Check that your site URL is correct and accessible</li>
                      <li>Ensure your WordPress site allows API connections</li>
                    </ul>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {connectionSuccess && (
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <div className="space-y-2">
                  <div>Successfully connected to <strong>{siteUrl}</strong>!</div>
                  <div className="text-sm">
                    Write mode is <strong>{writeMode ? 'enabled' : 'disabled'}</strong>. 
                    You can change this setting later if needed.
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">WordPress MCP Plugin Setup Guide</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://github.com/Automattic/wordpress-mcp', '_blank')}
            >
              <ExternalLinkIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">JWT Token Generation Guide</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://github.com/Automattic/wordpress-mcp#configuration', '_blank')}
            >
              <ExternalLinkIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Troubleshooting Connection Issues</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://github.com/Automattic/wordpress-mcp#troubleshooting', '_blank')}
            >
              <ExternalLinkIcon className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {!isConnectionComplete && siteUrl && jwtToken && (
        <Alert>
          <AlertDescription>
            Please test your WordPress connection before proceeding to the final step.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}