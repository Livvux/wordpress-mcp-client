import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';
import { isTestEnvironment } from '../constants';
import type { AIConfiguration } from './providers-config';

function loadAIConfigurationSync(): AIConfiguration | null {
  // Check if we're running on the client side
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
        return config;
      }

      return null;
    } catch (error) {
      console.warn(
        'Failed to load AI configuration from client storage:',
        error,
      );
      return null;
    }
  }

  // If on server side, try to use cookies synchronously
  try {
    // Try to access cookies if available
    if (typeof process !== 'undefined' && process.env) {
      // Check for environment variables as fallback
      const provider = process.env.AI_PROVIDER;
      const apiKey = process.env.AI_API_KEY;
      const model = process.env.AI_MODEL;

      if (provider && apiKey && model) {
        return { provider, apiKey, model };
      }
    }

    return null;
  } catch (error) {
    console.warn('Failed to load AI configuration from server storage:', error);
    return null;
  }
}

function createDynamicProvider() {
  if (isTestEnvironment) {
    return customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    });
  }

  // Load saved configuration from onboarding
  const aiConfig = loadAIConfigurationSync();

  if (!aiConfig) {
    // Fallback to environment-based configuration if no saved config
    return customProvider({
      languageModels: {
        'chat-model': xai('grok-2-vision-1212'),
        'chat-model-reasoning': wrapLanguageModel({
          model: xai('grok-3-mini-beta'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': xai('grok-2-1212'),
        'artifact-model': xai('grok-2-1212'),
      },
      imageModels: {
        'small-model': xai.imageModel('grok-2-image'),
      },
    });
  }

  // Create provider based on saved configuration
  let providerFunc: (model: string) => any;
  let config: { apiKey: string; baseURL?: string };

  switch (aiConfig.provider) {
    case 'openai':
      providerFunc = openai;
      config = { apiKey: aiConfig.apiKey };
      break;
    case 'anthropic':
      providerFunc = anthropic;
      config = { apiKey: aiConfig.apiKey };
      break;
    case 'google':
      providerFunc = google;
      config = { apiKey: aiConfig.apiKey };
      break;
    case 'openrouter':
      providerFunc = openai;
      config = {
        apiKey: aiConfig.apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
      };
      break;
    case 'deepseek':
      providerFunc = openai;
      config = { apiKey: aiConfig.apiKey, baseURL: 'https://api.deepseek.com' };
      break;
    case 'xai':
    default:
      providerFunc = xai;
      config = { apiKey: aiConfig.apiKey };
      break;
  }

  const mainModel = providerFunc(aiConfig.model);
  const titleModelVar = providerFunc(aiConfig.model); // Use same model for titles

  return customProvider({
    languageModels: {
      'chat-model': mainModel,
      'chat-model-reasoning':
        aiConfig.provider === 'xai'
          ? wrapLanguageModel({
              model: providerFunc('grok-3-mini-beta'),
              middleware: extractReasoningMiddleware({ tagName: 'think' }),
            })
          : mainModel,
      'title-model': titleModelVar,
      'artifact-model': mainModel,
    },
    imageModels:
      aiConfig.provider === 'xai'
        ? { 'small-model': xai.imageModel('grok-2-image') }
        : undefined,
  });
}

export function getMyProvider() {
  return createDynamicProvider();
}

// Create a provider instance that will be resolved at runtime
export const myProvider = createDynamicProvider();
