'use server';

import { generateText, type UIMessage } from 'ai';
import { cookies } from 'next/headers';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
} from '@/lib/db/queries';
import type { VisibilityType } from '@/components/visibility-selector';
import type { AIConfiguration } from '@/lib/ai/providers-config';
import { customProvider } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';

async function getDynamicProvider() {
  // Try to load AI configuration from cookies
  const cookieStore = await cookies();
  const aiConfigCookie = cookieStore.get('ai_config');
  
  console.log('Cookie store contents:', {
    aiConfigExists: !!aiConfigCookie,
    cookieValue: aiConfigCookie?.value ? '[REDACTED]' : 'null'
  });
  
  let aiConfig: AIConfiguration | null = null;
  
  if (aiConfigCookie?.value) {
    try {
      aiConfig = JSON.parse(aiConfigCookie.value);
      console.log('Parsed AI config:', {
        provider: aiConfig?.provider,
        model: aiConfig?.model,
        hasApiKey: !!aiConfig?.apiKey
      });
    } catch (error) {
      console.warn('Failed to parse AI configuration from cookies:', error);
    }
  }

  if (!aiConfig) {
    console.log('No AI config found, falling back to default xAI');
    // Fallback to default xAI configuration
    return customProvider({
      languageModels: {
        'chat-model': xai('grok-2-vision-1212'),
        'title-model': xai('grok-2-1212'),
        'artifact-model': xai('grok-2-1212'),
      },
    });
  }

  // Create provider based on configuration
  console.log('Creating provider for:', aiConfig.provider);
  
  let mainModel: any;
  
  switch (aiConfig.provider) {
    case 'openai':
      console.log('Configuring OpenAI');
      try {
        const openaiProvider = createOpenAI({
          apiKey: aiConfig.apiKey,
        });
        mainModel = openaiProvider(aiConfig.model);
        console.log('OpenAI model created successfully');
      } catch (error) {
        console.error('Error creating OpenAI model:', error);
        throw error;
      }
      break;
    case 'anthropic':
      console.log('Configuring Anthropic with model:', aiConfig.model);
      try {
        mainModel = anthropic(aiConfig.model);
        console.log('Anthropic model created successfully');
      } catch (error) {
        console.error('Error creating Anthropic model:', error);
        throw error;
      }
      break;
    case 'google':
      console.log('Configuring Google with model:', aiConfig.model);
      try {
        mainModel = google(aiConfig.model);
        console.log('Google model created successfully');
      } catch (error) {
        console.error('Error creating Google model:', error);
        throw error;
      }
      break;
    case 'openrouter':
      console.log('Configuring OpenRouter');
      try {
        // Try the simpler approach first
        mainModel = openai(aiConfig.model);
        console.log('OpenRouter model created successfully');
      } catch (error) {
        console.error('Error creating OpenRouter model:', error);
        console.error('Full error details:', JSON.stringify(error, null, 2));
        throw error;
      }
      break;
    case 'deepseek':
      console.log('Configuring DeepSeek with model:', aiConfig.model);
      try {
        const deepSeekProvider = createOpenAI({
          apiKey: aiConfig.apiKey,
          baseURL: 'https://api.deepseek.com'
        });
        mainModel = deepSeekProvider(aiConfig.model);
        console.log('DeepSeek model created successfully');
      } catch (error) {
        console.error('Error creating DeepSeek model:', error);
        throw error;
      }
      break;
    case 'xai':
    default:
      console.log('Configuring xAI with model:', aiConfig.model);
      try {
        mainModel = xai(aiConfig.model);
        console.log('xAI model created successfully');
      } catch (error) {
        console.error('Error creating xAI model:', error);
        throw error;
      }
      break;
  }

  console.log('Model configured successfully for:', aiConfig.provider);
  
  return customProvider({
    languageModels: {
      'chat-model': mainModel,
      'title-model': mainModel,
      'artifact-model': mainModel,
    },
  });
}

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const dynamicProvider = await getDynamicProvider();
  
  const { text: title } = await generateText({
    model: dynamicProvider.languageModel('title-model'),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
    maxOutputTokens: 100,
  });

  return title;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}
