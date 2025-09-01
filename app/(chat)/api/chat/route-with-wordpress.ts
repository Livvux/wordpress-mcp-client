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
import { myProvider } from '@/lib/ai/providers';
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

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
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
