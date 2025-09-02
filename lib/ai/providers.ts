import { customProvider, extractReasoningMiddleware, wrapLanguageModel } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import { artifactModel, chatModel, reasoningModel, titleModel } from './models.test';
import { isTestEnvironment } from '../constants';

// Strictly server/env-based sync loader; never reads client storage
function loadAIConfigurationSync(): {
  provider?: string;
  apiKey?: string;
  chatModel?: string;
  reasoningModel?: string;
} | null {
  try {
    if (typeof process !== 'undefined' && process.env) {
      const provider = process.env.AI_PROVIDER;
      const apiKey = process.env.AI_API_KEY;
      const chatModel = process.env.AI_CHAT_MODEL || process.env.AI_MODEL;
      const reasoningModel = process.env.AI_REASONING_MODEL || undefined;
      if (provider && apiKey && chatModel) {
        return { provider, apiKey, chatModel, reasoningModel };
      }
    }
  } catch (error) {
    console.warn('Failed to load AI configuration from environment:', error);
  }
  return null;
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

  // Env-based configuration only; no client-provided config
  const aiConfig = loadAIConfigurationSync();
  if (!aiConfig) {
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

  const chatModelEnv = aiConfig.chatModel!;
  const reasoningModelEnv = aiConfig.reasoningModel;
  const mainModel = providerFunc(chatModelEnv);
  const titleModelVar = providerFunc(chatModelEnv);

  return customProvider({
    languageModels: {
      'chat-model': mainModel,
      'chat-model-reasoning':
        reasoningModelEnv
          ? aiConfig.provider === 'xai'
            ? wrapLanguageModel({
                model: providerFunc(reasoningModelEnv),
                middleware: extractReasoningMiddleware({ tagName: 'think' }),
              })
            : providerFunc(reasoningModelEnv)
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
