import {
  convertToModelMessages,
  createUIMessageStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth } from '@/app/(auth)/auth-simple';
import type { UserType } from '@/lib/session';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { loadWordPressTools } from '@/lib/ai/tools/wordpress-tools';
import { isProductionEnvironment } from '@/lib/constants';
import { customProvider } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';
import { cookies } from 'next/headers';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const authData = await auth();

    if (!authData?.session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const { session } = authData;
    const userType: UserType = session.user.type || 'guest';

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // Check for WordPress connection
    const cookieStore = await cookies();
    const wpBase = cookieStore.get('wp_base')?.value;
    const wpJwt = cookieStore.get('wp_jwt')?.value;
    const wpWriteMode = cookieStore.get('wp_write_mode')?.value === '1';

    // Load WordPress tools if connected
    let wordPressTools = {};
    let wpSystemPromptAddition = '';

    if (wpBase && wpJwt) {
      try {
        wordPressTools = await loadWordPressTools({
          wpBase,
          jwt: wpJwt,
          writeMode: wpWriteMode,
        });

        wpSystemPromptAddition = `

You are connected to a WordPress site at ${wpBase}.
Write Mode is ${wpWriteMode ? 'ENABLED' : 'DISABLED (read-only)'}.
${
  wpWriteMode
    ? 'You can create, update, and delete content on the WordPress site.'
    : 'You can only read content from the WordPress site. Any write operations will be blocked.'
}

When using WordPress tools:
- Always confirm destructive actions with the user first
- Provide clear feedback about what actions you're taking
- Handle errors gracefully and explain them to the user
- Use appropriate tools for the task at hand`;
      } catch (error) {
        console.error('Failed to load WordPress tools:', error);
        // Continue without WordPress tools
      }
    }

    // Combine default tools with WordPress tools
    const allTools = {
      getWeather,
      createDocument: createDocument({ session, dataStream: null as any }),
      updateDocument: updateDocument({ session, dataStream: null as any }),
      requestSuggestions: requestSuggestions({
        session,
        dataStream: null as any,
      }),
      ...wordPressTools,
    };

    // Build provider from admin config or environment
    async function buildProvider() {
      let adminCfg: any = null;
      try {
        const { getGlobalAIConfig } = await import('@/lib/db/queries');
        adminCfg = await getGlobalAIConfig();
      } catch {}

      if (adminCfg?.provider && (adminCfg as any)?.chatModel) {
        const provider = adminCfg.provider as string;
        const chatModelId = (adminCfg as any).chatModel as string;
        const reasoningModelId = (adminCfg as any).reasoningModel || chatModelId;
        let make: any = null;
        switch (provider) {
          case 'openai':
            make = createOpenAI({ apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '' });
            break;
          case 'anthropic':
            make = anthropic;
            break;
          case 'google':
            make = google;
            break;
          case 'openrouter':
            make = createOpenAI({ apiKey: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || '', baseURL: 'https://openrouter.ai/api/v1' });
            break;
          case 'deepseek':
            make = createOpenAI({ apiKey: process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || '', baseURL: 'https://api.deepseek.com' });
            break;
          case 'xai':
          default:
            make = xai;
            break;
        }
        return customProvider({
          languageModels: {
            'chat-model': make(chatModelId),
            'chat-model-reasoning': make(reasoningModelId),
            'title-model': make(chatModelId),
            'artifact-model': make(chatModelId),
          },
          imageModels: provider === 'xai' ? { 'small-model': xai.imageModel('grok-2-image') } : undefined,
        });
      }

      // Env fallback
      if (process.env.AI_PROVIDER && process.env.AI_API_KEY && process.env.AI_CHAT_MODEL) {
        const provider = process.env.AI_PROVIDER;
        const chatModelId = process.env.AI_CHAT_MODEL!;
        const reasoningModelId = process.env.AI_REASONING_MODEL || chatModelId;
        let make: any = null;
        switch (provider) {
          case 'openai':
            make = createOpenAI({ apiKey: process.env.AI_API_KEY });
            break;
          case 'anthropic':
            make = anthropic;
            break;
          case 'google':
            make = google;
            break;
          case 'openrouter':
            make = createOpenAI({ apiKey: process.env.AI_API_KEY, baseURL: 'https://openrouter.ai/api/v1' });
            break;
          case 'deepseek':
            make = createOpenAI({ apiKey: process.env.AI_API_KEY, baseURL: 'https://api.deepseek.com' });
            break;
          case 'xai':
          default:
            make = xai;
            break;
        }
        return customProvider({
          languageModels: {
            'chat-model': make(chatModelId),
            'chat-model-reasoning': make(reasoningModelId),
            'title-model': make(chatModelId),
            'artifact-model': make(chatModelId),
          },
          imageModels: provider === 'xai' ? { 'small-model': xai.imageModel('grok-2-image') } : undefined,
        });
      }

      // Defaults to xAI sensible presets
      return customProvider({
        languageModels: {
          'chat-model': xai('grok-2-vision-1212'),
          'chat-model-reasoning': xai('grok-3-mini-beta'),
          'title-model': xai('grok-2-1212'),
          'artifact-model': xai('grok-2-1212'),
        },
        imageModels: { 'small-model': xai.imageModel('grok-2-image') },
      });
    }

    const dynamicProvider = await buildProvider();

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: dynamicProvider.languageModel(selectedChatModel),
          system:
            systemPrompt({ selectedChatModel, requestHints }) +
            wpSystemPromptAddition,
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : (Object.keys(allTools) as any[]),
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: {
            ...allTools,
            // Override document tools with dataStream
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError('internal_error:chat').toResponse();
  }
}
