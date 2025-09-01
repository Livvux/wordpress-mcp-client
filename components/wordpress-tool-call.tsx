'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface WordPressToolCallProps {
  toolName: string;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: any;
  error?: string;
  args?: any;
}

export function WordPressToolCall({ 
  toolName, 
  status, 
  result, 
  error, 
  args 
}: WordPressToolCallProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'running':
        return 'default';
      case 'success':
        return 'success';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatToolName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Card className="my-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {getStatusIcon()}
            WordPress Tool: {formatToolName(toolName)}
          </CardTitle>
          <Badge variant={getStatusColor() as any}>
            {status}
          </Badge>
        </div>
        {args && Object.keys(args).length > 0 && (
          <CardDescription className="text-xs mt-1">
            Parameters: {JSON.stringify(args, null, 2)}
          </CardDescription>
        )}
      </CardHeader>
      {(result || error) && (
        <CardContent className="pt-0">
          {error ? (
            <div className="text-sm text-red-600 dark:text-red-400">
              Error: {error}
            </div>
          ) : result ? (
            <div className="text-sm">
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}