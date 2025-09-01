'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLinkIcon } from 'lucide-react';
import type { AIProvider } from '@/lib/ai/providers-config';
import { cn } from '@/lib/utils';
import { getProviderIcon } from './provider-icons';

interface ProviderCardsProps {
  providers: AIProvider[];
  selectedProvider: string | null;
  onProviderSelect: (providerId: string) => void;
}

export function ProviderCards({ providers, selectedProvider, onProviderSelect }: ProviderCardsProps) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {providers.map((provider) => {
        const isSelected = selectedProvider === provider.id;
        const isHovered = hoveredCard === provider.id;
        
        return (
          <Card
            key={provider.id}
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-lg",
              isSelected && "ring-2 ring-blue-600 ring-offset-2",
              isHovered && !isSelected && "shadow-md"
            )}
            onClick={() => onProviderSelect(provider.id)}
            onMouseEnter={() => setHoveredCard(provider.id)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getProviderIcon(provider.id)}
                  <div>
                    <CardTitle className="text-lg">{provider.name}</CardTitle>
                  </div>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <CardDescription className="text-sm leading-relaxed">
                {provider.description}
              </CardDescription>
              
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Popular Models:</div>
                <div className="flex flex-wrap gap-1">
                  {provider.models.slice(0, 2).map((model) => (
                    <Badge 
                      key={model.id} 
                      variant="outline" 
                      className="text-xs px-2 py-0.5"
                    >
                      {model.name}
                    </Badge>
                  ))}
                  {provider.models.length > 2 && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      +{provider.models.length - 2} more
                    </Badge>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs w-full justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(provider.websiteUrl, '_blank');
                  }}
                >
                  Get API Key
                  <ExternalLinkIcon className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}