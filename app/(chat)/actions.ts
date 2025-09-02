'use server';

import { generateText, type UIMessage } from 'ai';
import { cookies } from 'next/headers';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
} from '@/lib/db/queries';
import type { VisibilityType } from '@/components/visibility-selector';
import { customProvider } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';

async function getDynamicProvider() {
  // Admin-first: DB global config, then env, then sensible defaults
  try {
    const { getGlobalAIConfig } = await import('@/lib/db/queries');
    const cfg = await getGlobalAIConfig();
    if (cfg?.provider && (cfg as any).chatModel) {
      const provider = cfg.provider as string;
      const chatModelId = (cfg as any).chatModel as string;
      let make: any = null;
      switch (provider) {
        case 'openai':
          make = createOpenAI({
            apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '',
          });
          break;
        case 'anthropic':
          make = anthropic;
          break;
        case 'google':
          make = google;
          break;
        case 'openrouter':
          make = createOpenAI({
            apiKey:
              process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || '',
            baseURL: 'https://openrouter.ai/api/v1',
          });
          break;
        case 'deepseek':
          make = createOpenAI({
            apiKey:
              process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || '',
            baseURL: 'https://api.deepseek.com',
          });
          break;
        case 'xai':
        default:
          make = xai;
          break;
      }
      return customProvider({
        languageModels: {
          'chat-model': make(chatModelId),
          'title-model': make(chatModelId),
          'artifact-model': make(chatModelId),
        },
      });
    }
  } catch (e) {
    console.warn('Admin AI config lookup failed:', e);
  }

  {
    // Env-based fallback
    try {
      if (process.env.OPENAI_API_KEY) {
        const prov = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
        return customProvider({
          languageModels: {
            'chat-model': prov('gpt-4o-mini'),
            'title-model': prov('gpt-4o-mini'),
            'artifact-model': prov('gpt-4o-mini'),
          },
        });
      }
      if (process.env.ANTHROPIC_API_KEY) {
        return customProvider({
          languageModels: {
            'chat-model': anthropic('claude-3-5-sonnet-latest'),
            'title-model': anthropic('claude-3-5-sonnet-latest'),
            'artifact-model': anthropic('claude-3-5-sonnet-latest'),
          },
        });
      }
      if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        return customProvider({
          languageModels: {
            'chat-model': google('gemini-1.5-pro'),
            'title-model': google('gemini-1.5-pro'),
            'artifact-model': google('gemini-1.5-pro'),
          },
        });
      }
      if (process.env.XAI_API_KEY) {
        return customProvider({
          languageModels: {
            'chat-model': xai('grok-2-vision-1212'),
            'title-model': xai('grok-2-1212'),
            'artifact-model': xai('grok-2-1212'),
          },
        });
      }
      if (process.env.OPENROUTER_API_KEY) {
        const prov = createOpenAI({
          apiKey: process.env.OPENROUTER_API_KEY,
          baseURL: 'https://openrouter.ai/api/v1',
        });
        // Default to a capable small model id if not configured elsewhere
        return customProvider({
          languageModels: {
            'chat-model': prov('openrouter/auto'),
            'title-model': prov('openrouter/auto'),
            'artifact-model': prov('openrouter/auto'),
          },
        });
      }
      if (process.env.DEEPSEEK_API_KEY) {
        const prov = createOpenAI({
          apiKey: process.env.DEEPSEEK_API_KEY,
          baseURL: 'https://api.deepseek.com',
        });
        return customProvider({
          languageModels: {
            'chat-model': prov('deepseek-chat'),
            'title-model': prov('deepseek-chat'),
            'artifact-model': prov('deepseek-chat'),
          },
        });
      }
    } catch (e) {
      console.warn('Env-based provider fallback failed:', e);
    }
  }

  console.log(
    'No provider keys detected; returning xAI config (may fail without key)',
  );
  return customProvider({
    languageModels: {
      'chat-model': xai('grok-2-vision-1212'),
      'title-model': xai('grok-2-1212'),
      'artifact-model': xai('grok-2-1212'),
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
  // Helper: create a reasonable local title without calling any model
  const localTitleFromMessage = (msg: UIMessage) => {
    try {
      // UIMessage.content can be string or rich parts
      // Try common shapes to extract text
      const content: any = (msg as any).content ?? (msg as any).parts ?? msg;

      let text = '';
      if (typeof content === 'string') {
        text = content;
      } else if (Array.isArray(content)) {
        // Find first text-like part
        for (const part of content) {
          if (typeof part === 'string') {
            text = part;
            break;
          }
          if (part?.text) {
            text = part.text as string;
            break;
          }
          if (part?.type === 'text' && part?.value) {
            text = String(part.value);
            break;
          }
        }
        if (!text) {
          // Join any primitive strings we can find
          text = content
            .map((p: any) =>
              typeof p === 'string' ? p : p?.text || p?.value || '',
            )
            .filter(Boolean)
            .join(' ');
        }
      } else if (typeof content === 'object') {
        text = content?.text || content?.value || '';
      }

      if (!text) {
        // Last resort: stringify and strip JSON punctuation
        text = JSON.stringify(msg).replace(/[{}\[\]\"\n]/g, ' ');
      }

      text = text.trim().replace(/\s+/g, ' ');
      if (!text) return 'New Chat';

      // Prefer first sentence-ish ender, else truncate
      const sentenceEnd = text.search(/[.!?]\s|$/);
      let candidate = text.slice(0, Math.max(1, sentenceEnd)).trim();
      if (!candidate) candidate = text;

      // Enforce 80 chars max
      if (candidate.length > 80) candidate = candidate.slice(0, 80).trim();
      // Avoid quotes/colons per rules
      candidate = candidate.replace(/[\":]/g, '');
      return candidate || 'New Chat';
    } catch {
      return 'New Chat';
    }
  };

  try {
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
  } catch (error: any) {
    // If any provider/model/API key issue occurs, fall back locally to avoid 500s
    const msg = String(error?.message || error);
    const name = String(error?.name || '');
    if (
      name.includes('AI_LoadAPIKeyError') ||
      /api key is missing/i.test(msg) ||
      /missing api key/i.test(msg)
    ) {
      console.warn(
        'generateTitleFromUserMessage: missing API key, using local fallback',
      );
      return localTitleFromMessage(message);
    }
    console.error('generateTitleFromUserMessage: unexpected error', error);
    // Non-key related errors: still avoid crashing API by using local fallback
    return localTitleFromMessage(message);
  }
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  try {
    const [message] = await getMessageById({ id });

    await deleteMessagesByChatIdAfterTimestamp({
      chatId: message.chatId,
      timestamp: message.createdAt,
    });
  } catch (error) {
    // In test or environments without a DB, ignore cleanup failures.
    console.warn('deleteTrailingMessages: non-fatal error, continuing', error);
  }
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
