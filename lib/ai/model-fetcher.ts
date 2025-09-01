import type { AIModel } from './providers-config';

// Model cache with expiry
interface ModelCache {
  models: AIModel[];
  timestamp: number;
  expiresIn: number; // in milliseconds
}

const modelCache = new Map<string, ModelCache>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Default models as fallback
const DEFAULT_MODELS: Record<string, AIModel[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable model, great for complex tasks', contextWindow: '128K tokens' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Faster and more affordable GPT-4 level intelligence', contextWindow: '128K tokens' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient for most tasks', contextWindow: '16K tokens' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Most intelligent model, excellent for coding and analysis', contextWindow: '200K tokens' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest model, great for quick tasks', contextWindow: '200K tokens' },
  ],
  google: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable Gemini model with long context', contextWindow: '2M tokens' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and efficient multimodal model', contextWindow: '1M tokens' },
  ],
  openrouter: [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: '', contextWindow: '200K tokens' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', description: '', contextWindow: '128K tokens' },
    { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', description: '', contextWindow: '2M tokens' },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', description: 'General purpose conversational model', contextWindow: '32K tokens' },
    { id: 'deepseek-coder', name: 'DeepSeek Coder', description: 'Specialized for coding tasks', contextWindow: '32K tokens' },
  ],
  xai: [
    { id: 'grok-2-vision-1212', name: 'Grok 2 Vision', description: 'Latest Grok with vision capabilities', contextWindow: '128K tokens' },
    { id: 'grok-2-1212', name: 'Grok 2', description: 'Latest Grok model for conversations', contextWindow: '128K tokens' },
    { id: 'grok-3-mini-beta', name: 'Grok 3 Mini (Beta)', description: 'Compact beta version of Grok 3', contextWindow: '128K tokens' },
  ],
};

interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface AnthropicModel {
  id: string;
  display_name: string;
  created_at: string;
}

interface GoogleModel {
  name: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
}

interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
}

// OpenAI model fetching
async function fetchOpenAIModels(apiKey: string): Promise<AIModel[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized - invalid API key');
      }
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data as OpenAIModel[];
    
    return models
      .filter(model => model.id.startsWith('gpt-') || model.id.includes('o1-'))
      .map(model => ({
        id: model.id,
        name: formatModelName(model.id),
        description: getModelDescription(model.id),
        contextWindow: getContextWindow(model.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Failed to fetch OpenAI models:', error);
    // Re-throw authentication errors instead of falling back
    if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
      throw error;
    }
    return DEFAULT_MODELS.openai;
  }
}

// Anthropic model fetching
async function fetchAnthropicModels(apiKey: string): Promise<AIModel[]> {
  try {
    // Anthropic doesn't have a public models API, so we'll use a predefined list
    // but check if the API key is valid by making a test request
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized - invalid API key');
      }
    }

    // If we can make a request (even if it fails for other reasons), the API key is valid
    // Return the latest known models
    return [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Most intelligent model, excellent for coding and analysis', contextWindow: '200K tokens' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest model, great for quick tasks', contextWindow: '200K tokens' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most powerful model for highly complex tasks', contextWindow: '200K tokens' },
    ];
  } catch (error) {
    console.error('Failed to validate Anthropic API key:', error);
    // Re-throw authentication errors instead of falling back
    if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
      throw error;
    }
    return DEFAULT_MODELS.anthropic;
  }
}

// Google model fetching
async function fetchGoogleModels(apiKey: string): Promise<AIModel[]> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

    if (!response.ok) {
      if (response.status === 400 || response.status === 403) {
        throw new Error('Unauthorized - invalid API key');
      }
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();
    const models = data.models as GoogleModel[];
    
    return models
      .filter(model => model.name.includes('gemini'))
      .map(model => ({
        id: model.name.replace('models/', ''),
        name: model.displayName || formatModelName(model.name),
        description: model.description || 'Google Gemini model',
        contextWindow: formatTokenCount(model.inputTokenLimit),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Failed to fetch Google models:', error);
    // Re-throw authentication errors instead of falling back
    if (error instanceof Error && (error.message.includes('401') || error.message.includes('403') || error.message.includes('400') || error.message.includes('Unauthorized'))) {
      throw error;
    }
    return DEFAULT_MODELS.google;
  }
}

// OpenRouter model fetching
async function fetchOpenRouterModels(apiKey: string): Promise<AIModel[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized - invalid API key');
      }
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data as OpenRouterModel[];
    
    // Return ALL available models without filtering
    return models
      .map(model => ({
        id: model.id,
        name: model.name,
        description: '', // Remove description to make compact
        contextWindow: formatTokenCount(model.context_length),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Failed to fetch OpenRouter models:', error);
    // Re-throw authentication errors instead of falling back
    if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
      throw error;
    }
    return DEFAULT_MODELS.openrouter;
  }
}

// DeepSeek model fetching
async function fetchDeepSeekModels(apiKey: string): Promise<AIModel[]> {
  try {
    const response = await fetch('https://api.deepseek.com/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized - invalid API key');
      }
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data as OpenAIModel[];
    
    return models
      .map(model => ({
        id: model.id,
        name: formatModelName(model.id),
        description: getModelDescription(model.id),
        contextWindow: getContextWindow(model.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Failed to fetch DeepSeek models:', error);
    // Re-throw authentication errors instead of falling back
    if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
      throw error;
    }
    return DEFAULT_MODELS.deepseek;
  }
}

// xAI model fetching
async function fetchXAIModels(apiKey: string): Promise<AIModel[]> {
  try {
    const response = await fetch('https://api.x.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized - invalid API key');
      }
      throw new Error(`xAI API error: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data as OpenAIModel[];
    
    return models
      .map(model => ({
        id: model.id,
        name: formatModelName(model.id),
        description: getModelDescription(model.id),
        contextWindow: getContextWindow(model.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Failed to fetch xAI models:', error);
    // Re-throw authentication errors instead of falling back
    if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
      throw error;
    }
    return DEFAULT_MODELS.xai;
  }
}

// Main function to fetch models for any provider
export async function fetchModelsForProvider(providerId: string, apiKey: string): Promise<AIModel[]> {
  // Check cache first
  const cached = modelCache.get(`${providerId}_${apiKey.slice(-4)}`);
  if (cached && Date.now() - cached.timestamp < cached.expiresIn) {
    return cached.models;
  }

  let models: AIModel[];
  
  switch (providerId) {
    case 'openai':
      models = await fetchOpenAIModels(apiKey);
      break;
    case 'anthropic':
      models = await fetchAnthropicModels(apiKey);
      break;
    case 'google':
      models = await fetchGoogleModels(apiKey);
      break;
    case 'openrouter':
      models = await fetchOpenRouterModels(apiKey);
      break;
    case 'deepseek':
      models = await fetchDeepSeekModels(apiKey);
      break;
    case 'xai':
      models = await fetchXAIModels(apiKey);
      break;
    default:
      models = DEFAULT_MODELS[providerId] || [];
  }

  // Cache the results
  modelCache.set(`${providerId}_${apiKey.slice(-4)}`, {
    models,
    timestamp: Date.now(),
    expiresIn: CACHE_DURATION,
  });

  return models;
}

// Utility functions
function formatModelName(id: string): string {
  return id
    .split(/[-_/]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getModelDescription(id: string): string {
  const descriptions: Record<string, string> = {
    'gpt-4o': 'Most capable model, great for complex tasks',
    'gpt-4o-mini': 'Faster and more affordable GPT-4 level intelligence',
    'gpt-3.5-turbo': 'Fast and efficient for most tasks',
    'o1-preview': 'Advanced reasoning model for complex problems',
    'o1-mini': 'Faster reasoning model for coding and STEM',
    'deepseek-chat': 'General purpose conversational model',
    'deepseek-coder': 'Specialized for coding tasks',
  };
  
  return descriptions[id] || 'AI language model';
}

function getContextWindow(id: string): string {
  const contextWindows: Record<string, string> = {
    'gpt-4o': '128K tokens',
    'gpt-4o-mini': '128K tokens',
    'gpt-3.5-turbo': '16K tokens',
    'o1-preview': '128K tokens',
    'o1-mini': '128K tokens',
    'deepseek-chat': '32K tokens',
    'deepseek-coder': '32K tokens',
  };
  
  return contextWindows[id] || 'Unknown';
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M tokens`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}K tokens`;
  }
  return `${tokens} tokens`;
}

// Clear cache for a specific provider
export function clearModelCache(providerId?: string, apiKey?: string): void {
  if (providerId && apiKey) {
    modelCache.delete(`${providerId}_${apiKey.slice(-4)}`);
  } else if (providerId) {
    for (const key of modelCache.keys()) {
      if (key.startsWith(providerId)) {
        modelCache.delete(key);
      }
    }
  } else {
    modelCache.clear();
  }
}