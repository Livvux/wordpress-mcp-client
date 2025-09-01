import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import { fetchModelsForProvider } from './model-fetcher';

export interface AIProvider {
  id: string;
  name: string;
  description: string;
  logoUrl: string;
  models: AIModel[];
  apiKeyPlaceholder: string;
  websiteUrl: string;
  setupInstructions: string;
  supportsDynamicModels?: boolean;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  contextWindow?: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4 and GPT-3.5 models for high-quality conversations',
    logoUrl: '/logos/openai.svg',
    apiKeyPlaceholder: 'sk-...',
    websiteUrl: 'https://platform.openai.com/api-keys',
    setupInstructions: 'Get your API key from OpenAI Platform → API Keys',
    supportsDynamicModels: true,
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Most capable model, great for complex tasks',
        contextWindow: '128K tokens',
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Faster and more affordable GPT-4 level intelligence',
        contextWindow: '128K tokens',
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and efficient for most tasks',
        contextWindow: '16K tokens',
      },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models known for safety and helpfulness',
    logoUrl: '/logos/anthropic.svg',
    apiKeyPlaceholder: 'sk-ant-...',
    websiteUrl: 'https://console.anthropic.com/account/keys',
    setupInstructions: 'Get your API key from Anthropic Console → API Keys',
    supportsDynamicModels: true,
    models: [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Most intelligent model, excellent for coding and analysis',
        contextWindow: '200K tokens',
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fastest model, great for quick tasks',
        contextWindow: '200K tokens',
      },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    description: 'Gemini models with strong reasoning capabilities',
    logoUrl: '/logos/google.svg',
    apiKeyPlaceholder: 'AI...',
    websiteUrl: 'https://aistudio.google.com/app/apikey',
    setupInstructions: 'Get your API key from Google AI Studio → Get API Key',
    supportsDynamicModels: true,
    models: [
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Most capable Gemini model with long context',
        contextWindow: '2M tokens',
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'Fast and efficient multimodal model',
        contextWindow: '1M tokens',
      },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access to multiple AI models through one API',
    logoUrl: '/logos/openrouter.svg',
    apiKeyPlaceholder: 'sk-or-...',
    websiteUrl: 'https://openrouter.ai/keys',
    setupInstructions: 'Get your API key from OpenRouter → API Keys',
    supportsDynamicModels: true,
    models: [
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        description: '',
        contextWindow: '200K tokens',
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        description: '',
        contextWindow: '128K tokens',
      },
      {
        id: 'google/gemini-pro-1.5',
        name: 'Gemini Pro 1.5',
        description: '',
        contextWindow: '2M tokens',
      },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'High-performance models at competitive pricing',
    logoUrl: '/logos/deepseek.svg',
    apiKeyPlaceholder: 'sk-...',
    websiteUrl: 'https://platform.deepseek.com/api_keys',
    setupInstructions: 'Get your API key from DeepSeek Platform → API Keys',
    supportsDynamicModels: true,
    models: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        description: 'General purpose conversational model',
        contextWindow: '32K tokens',
      },
      {
        id: 'deepseek-coder',
        name: 'DeepSeek Coder',
        description: 'Specialized for coding tasks',
        contextWindow: '32K tokens',
      },
    ],
  },
  {
    id: 'xai',
    name: 'xAI',
    description: 'Grok models with real-time information access',
    logoUrl: '/logos/xai.svg',
    apiKeyPlaceholder: 'xai-...',
    websiteUrl: 'https://console.x.ai/',
    setupInstructions: 'Get your API key from xAI Console',
    supportsDynamicModels: true,
    models: [
      {
        id: 'grok-2-vision-1212',
        name: 'Grok 2 Vision',
        description: 'Latest Grok with vision capabilities',
        contextWindow: '128K tokens',
      },
      {
        id: 'grok-2-1212',
        name: 'Grok 2',
        description: 'Latest Grok model for conversations',
        contextWindow: '128K tokens',
      },
      {
        id: 'grok-3-mini-beta',
        name: 'Grok 3 Mini (Beta)',
        description: 'Compact beta version of Grok 3',
        contextWindow: '128K tokens',
      },
    ],
  },
];

export function createProviderInstance(providerId: string, apiKey: string) {
  switch (providerId) {
    case 'openai':
      return openai;
    case 'anthropic':
      return anthropic;
    case 'google':
      return google;
    case 'openrouter':
      return openai; // OpenRouter uses OpenAI-compatible API
    case 'deepseek':
      return openai; // DeepSeek uses OpenAI-compatible API
    case 'xai':
      return xai;
    default:
      throw new Error(`Unsupported provider: ${providerId}`);
  }
}

export function getProviderConfig(providerId: string, apiKey: string) {
  switch (providerId) {
    case 'openai':
      return { apiKey };
    case 'anthropic':
      return { apiKey };
    case 'google':
      return { apiKey };
    case 'openrouter':
      return { 
        apiKey, 
        baseURL: 'https://openrouter.ai/api/v1' 
      };
    case 'deepseek':
      return { 
        apiKey, 
        baseURL: 'https://api.deepseek.com' 
      };
    case 'xai':
      return { apiKey };
    default:
      throw new Error(`Unsupported provider: ${providerId}`);
  }
}

export function validateApiKey(providerId: string, apiKey: string): boolean {
  if (!apiKey || apiKey.trim().length === 0) return false;
  
  switch (providerId) {
    case 'openai':
      return apiKey.startsWith('sk-') && apiKey.length > 20;
    case 'anthropic':
      return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
    case 'google':
      return apiKey.startsWith('AI') && apiKey.length > 10;
    case 'openrouter':
      return (apiKey.startsWith('sk-or-') || apiKey.startsWith('sk-')) && apiKey.length > 20;
    case 'deepseek':
      return apiKey.startsWith('sk-') && apiKey.length > 20;
    case 'xai':
      return apiKey.startsWith('xai-') && apiKey.length > 20;
    default:
      return false;
  }
}

export interface AIConfiguration {
  provider: string;
  apiKey: string;
  model: string;
}

export async function saveAIConfiguration(config: AIConfiguration): Promise<void> {
  // Save to client-side storage if we're on the client
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('ai-config', JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to save AI configuration to sessionStorage:', error);
      // Fallback to localStorage if sessionStorage is not available
      localStorage.setItem('ai-config', JSON.stringify(config));
    }
  }

  // Also save to server-side cookies
  try {
    const response = await fetch('/api/ai/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      console.warn('Failed to save AI configuration to cookies');
    }
  } catch (error) {
    console.warn('Failed to save AI configuration to server:', error);
  }
}

export async function loadAIConfiguration(): Promise<AIConfiguration | null> {
  // If on client side, use client-side storage
  if (typeof window !== 'undefined') {
    try {
      // First try sessionStorage
      let saved = sessionStorage.getItem('ai-config');
      if (saved) {
        return JSON.parse(saved);
      }
      
      // Fallback to localStorage (for migration purposes)
      saved = localStorage.getItem('ai-config');
      if (saved) {
        const config = JSON.parse(saved);
        // Migrate to sessionStorage and remove from localStorage
        await saveAIConfiguration(config);
        localStorage.removeItem('ai-config');
        return config;
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to load AI configuration from client storage:', error);
      return null;
    }
  }

  // If on server side, use cookies
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const aiConfigCookie = cookieStore.get('ai_config');
    
    if (!aiConfigCookie?.value) {
      return null;
    }

    return JSON.parse(aiConfigCookie.value);
  } catch (error) {
    console.warn('Failed to load AI configuration from server storage:', error);
    return null;
  }
}

export async function clearAIConfiguration(): Promise<void> {
  // Clear client-side storage if we're on the client
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem('ai-config');
      localStorage.removeItem('ai-config'); // Also clear any old localStorage data
    } catch (error) {
      console.warn('Failed to clear AI configuration from client storage:', error);
    }
  }

  // Also clear server-side cookies
  try {
    const response = await fetch('/api/ai/config', {
      method: 'DELETE',
    });

    if (!response.ok) {
      console.warn('Failed to clear AI configuration from cookies');
    }
  } catch (error) {
    console.warn('Failed to clear AI configuration from server:', error);
  }
}

// Get models for a provider, with optional dynamic fetching
export async function getModelsForProvider(
  providerId: string, 
  apiKey?: string,
  forceFetch = false
): Promise<AIModel[]> {
  const provider = AI_PROVIDERS.find(p => p.id === providerId);
  
  if (!provider) {
    return [];
  }

  // If dynamic models are supported and API key is provided, fetch dynamically
  if (provider.supportsDynamicModels && apiKey && (forceFetch || apiKey.length > 10)) {
    try {
      const dynamicModels = await fetchModelsForProvider(providerId, apiKey);
      return dynamicModels.length > 0 ? dynamicModels : provider.models;
    } catch (error) {
      console.error(`Failed to fetch models for ${providerId}:`, error);
      return provider.models;
    }
  }

  // Return static models
  return provider.models;
}