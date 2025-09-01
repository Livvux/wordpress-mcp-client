'use client';

import { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { Button } from './ui/button';
import { ToolsIcon } from './icons/tools-icon';
import { categorizeTools } from '@/lib/ai/tools/wordpress-tools';
import type { MCPTool } from '@/lib/mcp/client';

interface ToolsModalProps {
  status: 'ready' | 'submitted' | 'idle' | 'streaming' | 'error';
  isConnected: boolean;
}

interface MCPToolsResponse {
  tools: MCPTool[];
}

const categoryLabels: Record<string, string> = {
  posts: 'Posts',
  pages: 'Pages', 
  media: 'Media',
  users: 'Users',
  settings: 'Settings',
  woocommerce: 'WooCommerce',
  other: 'Other'
};

export function ToolsModal({ status, isConnected }: ToolsModalProps) {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTools = async () => {
    if (!isConnected) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/mcp/tools/list', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Tools list error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Try to parse error details
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Keep the HTTP error message
        }
        
        throw new Error(errorMessage);
      }

      const data: MCPToolsResponse = await response.json();
      console.log('Tools loaded:', data);
      setTools(data.tools || []);
    } catch (err) {
      console.error('Error fetching tools:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchTools();
    }
  }, [isConnected]);

  const categorizedTools = categorizeTools(tools);
  const totalTools = tools.length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <div className="relative">
          <Button
            data-testid="tools-modal-button"
            className="rounded-md p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200 relative"
            disabled={status !== 'ready' || !isConnected}
            variant="ghost"
            type="button"
          >
            <ToolsIcon size={14} />
            {isConnected && totalTools > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-green-600 text-white text-[10px] font-medium rounded-full flex items-center justify-center px-1">
                {totalTools}
              </div>
            )}
          </Button>
        </div>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle>WordPress MCP Tools</SheetTitle>
          <SheetDescription>
            Available tools from your WordPress MCP connection
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden">
          {!isConnected ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Connect to WordPress to view available tools</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">
              <div>
                <p className="text-center mb-4">Error loading tools</p>
                <p className="text-sm text-center mb-4">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchTools}
                  className="mx-auto block"
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : totalTools === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>No tools available</p>
            </div>
          ) : (
            <div className="space-y-6 overflow-y-auto h-full pr-2">
              {Object.entries(categorizedTools).map(([category, categoryTools]) => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">{categoryLabels[category] || category}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {categoryTools.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {categoryTools.map((tool) => (
                      <div 
                        key={tool.name}
                        className="p-3 border rounded-lg space-y-2 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">{tool.name}</h4>
                          {tool.kind && (
                            <Badge 
                              variant={tool.kind === 'action' ? 'default' : 'outline'}
                              className="text-xs"
                            >
                              {tool.kind}
                            </Badge>
                          )}
                        </div>
                        {tool.description && (
                          <p className="text-sm text-muted-foreground">
                            {tool.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {isConnected && totalTools > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground text-center">
              Total: {totalTools} tool{totalTools !== 1 ? 's' : ''} available
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}