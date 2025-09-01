import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth } from '@/app/(auth)/auth-simple';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
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
import { firecrawlTools } from '@/lib/ai/tools/firecrawl-tools';
import { isProductionEnvironment } from '@/lib/constants';
import type { AIConfiguration } from '@/lib/ai/providers-config';
import { customProvider } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
// import { entitlementsByUserType } from '@/lib/ai/entitlements'; // Disabled for minimal MCP client
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import { cookies } from 'next/headers';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';
import { getWordPressConnectionByUserId } from '@/lib/db/queries';
import { BILLING_ENABLED, FREE_TRIAL_DAYS } from '@/lib/config';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

async function getDynamicProvider() {
  // Try to load AI configuration from cookies
  const cookieStore = await cookies();
  const aiConfigCookie = cookieStore.get('ai_config');

  console.log('[CHAT ROUTE] Cookie store contents:', {
    aiConfigExists: !!aiConfigCookie,
    cookieValue: aiConfigCookie?.value ? '[REDACTED]' : 'null',
  });

  let aiConfig: AIConfiguration | null = null;

  if (aiConfigCookie?.value) {
    try {
      aiConfig = JSON.parse(aiConfigCookie.value);
      console.log('[CHAT ROUTE] Parsed AI config:', {
        provider: aiConfig?.provider,
        model: aiConfig?.model,
        hasApiKey: !!aiConfig?.apiKey,
      });
    } catch (error) {
      console.warn('Failed to parse AI configuration from cookies:', error);
    }
  }

  if (!aiConfig) {
    // Try DB-backed integration as fallback
    try {
      const authData = await auth();
      if (authData?.user) {
        const latest = await (
          await import('@/lib/db/queries')
        ).getLatestAIIntegrationByUserId(authData.user.id);
        if (latest) {
          aiConfig = {
            provider: latest.provider as any,
            apiKey: latest.apiKey,
            model: latest.model,
          } as any;
        }
      }
    } catch (e) {
      console.warn('[CHAT ROUTE] Failed to load AI config from DB:', e);
    }

    if (!aiConfig) {
      console.log(
        '[CHAT ROUTE] No AI config found, falling back to default xAI',
      );
      // Fallback to default xAI configuration
      return customProvider({
        languageModels: {
          'chat-model': xai('grok-2-vision-1212'),
          'title-model': xai('grok-2-1212'),
          'artifact-model': xai('grok-2-1212'),
        },
        imageModels: {
          'small-model': xai.imageModel('grok-2-image'),
        },
      });
    }
  }

  // Create provider based on configuration
  console.log('[CHAT ROUTE] Creating provider for:', aiConfig.provider);

  let mainModel: any;

  switch (aiConfig.provider) {
    case 'openai':
      console.log('[CHAT ROUTE] Configuring OpenAI');
      try {
        const openaiProvider = createOpenAI({
          apiKey: aiConfig.apiKey,
        });
        mainModel = openaiProvider(aiConfig.model);
        console.log('[CHAT ROUTE] OpenAI model created successfully');
      } catch (error) {
        console.error('[CHAT ROUTE] Error creating OpenAI model:', error);
        throw error;
      }
      break;
    case 'anthropic':
      console.log(
        '[CHAT ROUTE] Configuring Anthropic with model:',
        aiConfig.model,
      );
      try {
        mainModel = anthropic(aiConfig.model);
        console.log('[CHAT ROUTE] Anthropic model created successfully');
      } catch (error) {
        console.error('[CHAT ROUTE] Error creating Anthropic model:', error);
        throw error;
      }
      break;
    case 'google':
      console.log(
        '[CHAT ROUTE] Configuring Google with model:',
        aiConfig.model,
      );
      try {
        mainModel = google(aiConfig.model);
        console.log('[CHAT ROUTE] Google model created successfully');
      } catch (error) {
        console.error('[CHAT ROUTE] Error creating Google model:', error);
        throw error;
      }
      break;
    case 'openrouter':
      console.log('[CHAT ROUTE] Configuring OpenRouter');
      try {
        // Try the simpler approach first
        mainModel = openai(aiConfig.model);
        console.log('[CHAT ROUTE] OpenRouter model created successfully');
      } catch (error) {
        console.error('[CHAT ROUTE] Error creating OpenRouter model:', error);
        console.error(
          '[CHAT ROUTE] Full error details:',
          JSON.stringify(error, null, 2),
        );
        throw error;
      }
      break;
    case 'deepseek':
      console.log(
        '[CHAT ROUTE] Configuring DeepSeek with model:',
        aiConfig.model,
      );
      try {
        const deepSeekProvider = createOpenAI({
          apiKey: aiConfig.apiKey,
          baseURL: 'https://api.deepseek.com',
        });
        mainModel = deepSeekProvider(aiConfig.model);
        console.log('[CHAT ROUTE] DeepSeek model created successfully');
      } catch (error) {
        console.error('[CHAT ROUTE] Error creating DeepSeek model:', error);
        throw error;
      }
      break;
    case 'xai':
    default:
      console.log('[CHAT ROUTE] Configuring xAI with model:', aiConfig.model);
      try {
        mainModel = xai(aiConfig.model);
        console.log('[CHAT ROUTE] xAI model created successfully');
      } catch (error) {
        console.error('[CHAT ROUTE] Error creating xAI model:', error);
        throw error;
      }
      break;
  }

  console.log(
    '[CHAT ROUTE] Model configured successfully for:',
    aiConfig.provider,
  );

  return customProvider({
    languageModels: {
      'chat-model': mainModel,
      'title-model': mainModel,
      'artifact-model': mainModel,
    },
    imageModels:
      aiConfig.provider === 'xai'
        ? { 'small-model': xai.imageModel('grok-2-image') }
        : undefined,
  });
}

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

    if (!authData?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    // Monetization gate: simple 3-day free trial, then require upgrade
    if (BILLING_ENABLED) {
      const cookieStore = await cookies();
      const trialCookie = cookieStore.get('trial_until')?.value;
      let trialUntil = trialCookie ? new Date(trialCookie) : null;
      if (!trialUntil || Number.isNaN(trialUntil.getTime())) {
        trialUntil = new Date(
          Date.now() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000,
        );
        cookieStore.set('trial_until', trialUntil.toISOString(), {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: FREE_TRIAL_DAYS * 24 * 60 * 60,
          path: '/',
        });
      } else if (Date.now() > trialUntil.getTime()) {
        return new Response(
          JSON.stringify({
            error: 'upgrade_required',
            message:
              'Your free trial has ended. Please upgrade to continue chatting.',
            trialEnded: true,
            trialUntil: trialUntil.toISOString(),
          }),
          { status: 402, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    // Simplified for minimal MCP client - no rate limiting for guest users
    const user = authData.user;

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== user.id) {
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

    // Check for WordPress connection from DB (server-side)
    const wpConn = await getWordPressConnectionByUserId(user.id);
    const wpBase = wpConn?.siteUrl;
    const wpJwt = wpConn?.jwt;
    const wpWriteMode = wpConn?.writeMode ?? false;

    // Load WordPress MCP tools if connected
    let wordPressTools = {};
    let wpSystemPromptAddition = '';

    if (wpBase && wpJwt) {
      try {
        wordPressTools = await loadWordPressTools({
          wpBase,
          jwt: wpJwt,
          writeMode: wpWriteMode,
        });

        const toolCount = Object.keys(wordPressTools).length;
        console.log(
          `WordPress MCP tools loaded: ${toolCount} tools available from ${wpBase}`,
        );

        wpSystemPromptAddition = `\n\nYou are connected to a WordPress site at ${wpBase} via MCP (Model Context Protocol).\nWrite Mode is ${wpWriteMode ? 'ENABLED' : 'DISABLED (read-only)'}.\n${
          wpWriteMode
            ? 'You can create, update, and delete content on the WordPress site.'
            : 'You can only read content from the WordPress site. Any write operations will be blocked.'
        }\n\nYou have access to ${toolCount} WordPress MCP tools that are dynamically loaded from the connected WordPress site. These tools allow you to:\n- Manage posts, pages, and custom post types\n- Handle media and attachments\n- Work with users and permissions\n- Access WooCommerce data (if available)\n- Manage settings and configurations\n- Execute custom WordPress operations\n- Access any custom MCP tools installed on the WordPress site\n\nIMPORTANT WordPress MCP Tool Usage:\n- ALWAYS use these tools when users ask about their WordPress content\n- These are real MCP tools connected to the actual WordPress site\n- The tools available depend on what's installed on the WordPress site\n- Tool names and capabilities are dynamically determined by the WordPress MCP server\n- Confirm destructive actions with the user first\n- Provide clear feedback about what actions you're taking\n- Handle errors gracefully and explain them to the user\n- If a tool fails, explain the error and suggest alternatives`;
      } catch (error) {
        console.error('Failed to load WordPress MCP tools:', error);
        // Continue without WordPress tools
      }
    } else {
      wpSystemPromptAddition = `\n\nNo WordPress site is currently connected. To use WordPress MCP tools, the user needs to connect their WordPress site through the setup process. The WordPress MCP integration allows full control over WordPress content and settings through the Model Context Protocol.`;
    }

    // Add Firecrawl capabilities to system prompt
    const firecrawlSystemPromptAddition = `\n\nFIRECRAWL WEB SCRAPING & CONTENT ANALYSIS TOOLS:
You have access to powerful Firecrawl v2 tools for web scraping and content strategy analysis:

🔍 CONTENT ANALYSIS TOOLS:
- analyzeWebContent: Scrape and analyze any website for SEO metrics, readability, content structure, and insights
- analyzeCompetitor: Deep analysis of competitor websites to identify content gaps and opportunities
- searchContentIdeas: Search the web for trending topics and content inspiration in any niche
- extractStructuredData: Extract specific data from websites using AI-powered extraction
- batchAnalyzeUrls: Analyze multiple URLs simultaneously for content comparison

📊 CONTENT STRATEGY CAPABILITIES:
- SEO analysis and scoring
- Content gap identification vs competitors
- Trending topic research
- Content structure analysis (headings, links, images)
- Reading time and word count metrics
- Sentiment analysis
- Keyword extraction
- Performance prediction insights

💡 STRATEGIC USE CASES:
- Competitor content analysis for WordPress sites
- Content strategy planning and optimization
- SEO audit and improvement recommendations
- Trending topic research for content calendars
- Content performance benchmarking
- Market research and competitive intelligence

IMPORTANT Firecrawl Usage Guidelines:
- ALWAYS use these tools for content strategy questions
- Perfect for analyzing competitor websites and content gaps
- Excellent for research and content planning
- Use analyzeCompetitor for comprehensive competitive analysis
- Use searchContentIdeas for trending topic research
- Combine with WordPress tools for complete content strategy
- Provide actionable insights and recommendations
- Handle errors gracefully and suggest alternatives`;

    wpSystemPromptAddition += firecrawlSystemPromptAddition;

    const dynamicProvider = await getDynamicProvider();

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: dynamicProvider.languageModel(selectedChatModel),
          system:
            systemPrompt({ selectedChatModel, requestHints }) +
            wpSystemPromptAddition,
          messages: convertToModelMessages(uiMessages),
          maxOutputTokens: 4096,
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                  'analyzeWebContent',
                  'analyzeCompetitor',
                  'searchContentIdeas',
                  'extractStructuredData',
                  'batchAnalyzeUrls',
                  ...(Object.keys(wordPressTools) as any[]),
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: {
            getWeather,
            createDocument: createDocument({
              session: authData.session,
              dataStream,
            }),
            updateDocument: updateDocument({
              session: authData.session,
              dataStream,
            }),
            requestSuggestions: requestSuggestions({
              session: authData.session,
              dataStream,
            }),
            ...firecrawlTools,
            ...wordPressTools,
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
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    console.error('Unexpected error in chat API:', error);
    return new ChatSDKError('internal_server_error:api').toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
