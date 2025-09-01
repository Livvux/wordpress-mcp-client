'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, ExternalLinkIcon, RefreshCw } from 'lucide-react';
import { ProviderCards } from '../provider-cards';
import { AI_PROVIDERS, validateApiKey, getModelsForProvider, saveAIConfiguration } from '@/lib/ai/providers-config';
import type { AIModel } from '@/lib/ai/providers-config';
// Remove AI SDK import since we'll use direct HTTP requests

async function testApiConnection(providerId: string, apiKey: string, modelId: string): Promise<void> {
  switch (providerId) {
    case 'openai':
      await testOpenAIConnection(apiKey, modelId);
      break;
    case 'anthropic':
      await testAnthropicConnection(apiKey, modelId);
      break;
    case 'google':
      await testGoogleConnection(apiKey, modelId);
      break;
    case 'openrouter':
      await testOpenRouterConnection(apiKey, modelId);
      break;
    case 'deepseek':
      await testDeepSeekConnection(apiKey, modelId);
      break;
    case 'xai':
      await testXAIConnection(apiKey, modelId);
      break;
    default:
      throw new Error(`Unsupported provider: ${providerId}`);
  }
}

async function testOpenAIConnection(apiKey: string, modelId: string): Promise<void> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: 'Hello' }],
      max_completion_tokens: 1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenAI API error: ${response.status} ${response.statusText}`);
  }
}

async function testAnthropicConnection(apiKey: string, modelId: string): Promise<void> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelId,
      max_completion_tokens: 1,
      messages: [{ role: 'user', content: 'Hello' }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Anthropic API error: ${response.status} ${response.statusText}`);
  }
}

async function testGoogleConnection(apiKey: string, modelId: string): Promise<void> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Hello' }] }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Google API error: ${response.status} ${response.statusText}`);
  }
}

async function testOpenRouterConnection(apiKey: string, modelId: string): Promise<void> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: 'Hello' }],
      max_completion_tokens: 1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenRouter API error: ${response.status} ${response.statusText}`);
  }
}

async function testDeepSeekConnection(apiKey: string, modelId: string): Promise<void> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: 'Hello' }],
      max_completion_tokens: 1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `DeepSeek API error: ${response.status} ${response.statusText}`);
  }
}

async function testXAIConnection(apiKey: string, modelId: string): Promise<void> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: 'Hello' }],
      max_completion_tokens: 1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `xAI API error: ${response.status} ${response.statusText}`);
  }
}

interface ApiSetupProps {
  selectedProvider: string | null;
  apiKey: string;
  selectedModel: string | null;
  onProviderChange: (providerId: string) => void;
  onApiKeyChange: (apiKey: string) => void;
  onModelChange: (modelId: string) => void;
  onValidationChange: (isValid: boolean) => void;
}

export function ApiSetup({
  selectedProvider,
  apiKey,
  selectedModel,
  onProviderChange,
  onApiKeyChange,
  onModelChange,
  onValidationChange,
}: ApiSetupProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const currentProvider = AI_PROVIDERS.find(p => p.id === selectedProvider);

  // Load models when provider or API key changes
  useEffect(() => {
    const loadModels = async () => {
      if (!selectedProvider) {
        setAvailableModels([]);
        return;
      }

      setIsLoadingModels(true);
      try {
        const models = await getModelsForProvider(selectedProvider, apiKey);
        setAvailableModels(models);
        // Clear any previous validation errors when models load successfully
        if (apiKey && models.length > 0) {
          setValidationError(null);
        }
      } catch (error) {
        console.error('Failed to load models:', error);
        // Check if this is an API key related error
        if (error instanceof Error && apiKey) {
          const message = error.message.toLowerCase();
          if (message.includes('unauthorized') || 
              message.includes('invalid api key') || 
              message.includes('authentication') ||
              message.includes('401') ||
              message.includes('forbidden')) {
            setValidationError('Your API key is invalid, please check again.');
          }
        }
        // Fallback to static models
        const provider = AI_PROVIDERS.find(p => p.id === selectedProvider);
        setAvailableModels(provider?.models || []);
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadModels();
  }, [selectedProvider, apiKey]);

  useEffect(() => {
    setValidationError(null);
    setValidationSuccess(false);
    onValidationChange(false);
  }, [selectedProvider, apiKey, selectedModel, onValidationChange]);

  const handleProviderSelect = (providerId: string) => {
    onProviderChange(providerId);
    onApiKeyChange('');
    onModelChange('');
    setValidationError(null);
    setValidationSuccess(false);
    setAvailableModels([]);
  };

  const validateConfiguration = async () => {
    if (!selectedProvider || !apiKey || !selectedModel) {
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setValidationSuccess(false);

    try {
      // Basic format validation
      if (!validateApiKey(selectedProvider, apiKey)) {
        throw new Error('API key format is invalid. Please check your API key and try again.');
      }

      // Test the API with a direct HTTP request
      await testApiConnection(selectedProvider, apiKey, selectedModel);

      // Save the configuration after successful validation
      await saveAIConfiguration({
        provider: selectedProvider,
        apiKey: apiKey,
        model: selectedModel,
      });

      setValidationSuccess(true);
      onValidationChange(true);
    } catch (error) {
      let errorMessage = 'Validation failed';
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        // Check for common API key related errors
        if (message.includes('unauthorized') || 
            message.includes('invalid api key') || 
            message.includes('authentication') ||
            message.includes('401') ||
            message.includes('api key') ||
            message.includes('forbidden') ||
            message.includes('invalid_api_key')) {
          errorMessage = 'Your API key is invalid, please check again.';
        } else if (message.includes('api key format is invalid')) {
          errorMessage = 'Your API key is invalid, please check again.';
        } else if (message.includes('quota') || message.includes('rate limit')) {
          errorMessage = 'API quota exceeded or rate limited. Please check your account.';
        } else if (message.includes('network') || message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          // Show the actual error for debugging
          errorMessage = error.message;
        }
      }
      
      setValidationError(errorMessage);
      onValidationChange(false);
    } finally {
      setIsValidating(false);
    }
  };

  const refreshModels = async () => {
    if (!selectedProvider || !apiKey) return;
    
    setIsLoadingModels(true);
    try {
      const models = await getModelsForProvider(selectedProvider, apiKey, true); // Force fetch
      setAvailableModels(models);
      setValidationError(null); // Clear any previous errors on successful refresh
    } catch (error) {
      console.error('Failed to refresh models:', error);
      // Check if this is an API key related error
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('unauthorized') || 
            message.includes('invalid api key') || 
            message.includes('authentication') ||
            message.includes('401') ||
            message.includes('forbidden')) {
          setValidationError('Your API key is invalid, please check again.');
        }
      }
    } finally {
      setIsLoadingModels(false);
    }
  };

  const canValidate = selectedProvider && apiKey && selectedModel && !isValidating;
  const isConfigurationComplete = validationSuccess && selectedProvider && apiKey && selectedModel;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Choose Your AI Provider</h2>
        <p className="text-muted-foreground">
          Select an AI provider and configure your API key to get started
        </p>
      </div>

      <ProviderCards
        providers={AI_PROVIDERS}
        selectedProvider={selectedProvider}
        onProviderSelect={handleProviderSelect}
      />

      {selectedProvider && currentProvider && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>Configure {currentProvider.name}</span>
              {validationSuccess && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            </CardTitle>
            <CardDescription>
              {currentProvider.setupInstructions}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Input
                    id="api-key"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={currentProvider.apiKeyPlaceholder}
                    value={apiKey}
                    onChange={(e) => onApiKeyChange(e.target.value)}
                    className={validationSuccess ? 'border-green-500' : ''}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open(currentProvider.websiteUrl, '_blank')}
                >
                  <ExternalLinkIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {apiKey && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="model-select">Model</Label>
                    {isLoadingModels && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    {currentProvider?.supportsDynamicModels && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        Auto-updated
                      </span>
                    )}
                  </div>
                  {currentProvider?.supportsDynamicModels && apiKey && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={refreshModels}
                      disabled={isLoadingModels}
                      className="h-6 px-2"
                    >
                      <RefreshCw className={`h-3 w-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                </div>
                <Select 
                  value={selectedModel || ''} 
                  onValueChange={onModelChange}
                  disabled={isLoadingModels || availableModels.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue 
                      placeholder={
                        isLoadingModels 
                          ? "Loading models..." 
                          : availableModels.length === 0
                          ? "No models available"
                          : "Select a model"
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.description ? (
                          <div className="flex flex-col">
                            <span>{model.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {model.description}
                              {model.contextWindow && ` • ${model.contextWindow}`}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full min-w-[200px]">
                            <span>{model.name}</span>
                            {model.contextWindow && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {model.contextWindow}
                              </span>
                            )}
                          </div>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedModel && (
              <div className="space-y-4">
                <Button
                  onClick={validateConfiguration}
                  disabled={!canValidate}
                  className="w-full"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing Connection...
                    </>
                  ) : (
                    'Test Configuration'
                  )}
                </Button>

                {validationError && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{validationError}</AlertDescription>
                  </Alert>
                )}

                {validationSuccess && (
                  <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      Configuration validated successfully! You can now proceed to the next step.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isConfigurationComplete && selectedProvider && apiKey && selectedModel && (
        <Alert>
          <AlertDescription>
            Please test your configuration before proceeding to the next step.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}