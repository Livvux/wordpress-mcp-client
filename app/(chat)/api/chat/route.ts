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
import { isProductionEnvironment, isTestEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
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
import {
  getWordPressConnectionByUserId,
  hasActiveSubscription,
  getLatestAIIntegrationByUserId,
} from '@/lib/db/queries';
import { BILLING_ENABLED, FREE_TRIAL_DAYS } from '@/lib/config';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

async function getDynamicProvider() {
  // In Playwright/test environment, use the mocked provider for determinism.
  if (isTestEnvironment) {
    return myProvider;
  }
  // Admin-first config: use global admin config from DB, then env-based fallback
  let adminConfig: {
    provider: string;
    chatModel: string;
    reasoningModel?: string | null;
  } | null = null;
  try {
    const { getGlobalAIConfig } = await import('@/lib/db/queries');
    const globalCfg = await getGlobalAIConfig();
    if (globalCfg?.provider && globalCfg?.chatModel) {
      adminConfig = {
        provider: globalCfg.provider,
        chatModel: (globalCfg as any).chatModel,
        reasoningModel: (globalCfg as any).reasoningModel ?? null,
      };
    }
  } catch (e) {
    console.warn('[CHAT ROUTE] Failed to load global AI config:', e);
  }

  if (!adminConfig) {
    // Environment-based fallback provider discovery
    try {
      if (
        process.env.AI_PROVIDER &&
        process.env.AI_API_KEY &&
        process.env.AI_CHAT_MODEL
      ) {
        const provider = process.env.AI_PROVIDER;
        const chatModel = process.env.AI_CHAT_MODEL;
        const reasoningModel = process.env.AI_REASONING_MODEL;
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
            make = createOpenAI({
              apiKey: process.env.AI_API_KEY,
              baseURL: 'https://openrouter.ai/api/v1',
            });
            break;
          case 'deepseek':
            make = createOpenAI({
              apiKey: process.env.AI_API_KEY,
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
            'chat-model': make(chatModel),
            'chat-model-reasoning': reasoningModel
              ? make(reasoningModel)
              : make(chatModel),
            'title-model': make(chatModel),
            'artifact-model': make(chatModel),
          },
          imageModels:
            provider === 'xai'
              ? { 'small-model': xai.imageModel('grok-2-image') }
              : undefined,
        });
      }
      if (process.env.OPENAI_API_KEY) {
        const prov = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
        return customProvider({
          languageModels: {
            'chat-model': prov('gpt-4o-mini'),
            'chat-model-reasoning': prov('gpt-4o-mini'),
            'title-model': prov('gpt-4o-mini'),
            'artifact-model': prov('gpt-4o-mini'),
          },
        });
      }
      if (process.env.ANTHROPIC_API_KEY) {
        return customProvider({
          languageModels: {
            'chat-model': anthropic('claude-3-5-sonnet-latest'),
            'chat-model-reasoning': anthropic('claude-3-5-sonnet-latest'),
            'title-model': anthropic('claude-3-5-sonnet-latest'),
            'artifact-model': anthropic('claude-3-5-sonnet-latest'),
          },
        });
      }
      if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        return customProvider({
          languageModels: {
            'chat-model': google('gemini-1.5-pro'),
            'chat-model-reasoning': google('gemini-1.5-pro'),
            'title-model': google('gemini-1.5-pro'),
            'artifact-model': google('gemini-1.5-pro'),
          },
        });
      }
      if (process.env.XAI_API_KEY) {
        return customProvider({
          languageModels: {
            'chat-model': xai('grok-2-vision-1212'),
            'chat-model-reasoning': xai('grok-3-mini-beta'),
            'title-model': xai('grok-2-1212'),
            'artifact-model': xai('grok-2-1212'),
          },
          imageModels: {
            'small-model': xai.imageModel('grok-2-image'),
          },
        });
      }
      if (process.env.OPENROUTER_API_KEY) {
        const prov = createOpenAI({
          apiKey: process.env.OPENROUTER_API_KEY,
          baseURL: 'https://openrouter.ai/api/v1',
        });
        return customProvider({
          languageModels: {
            'chat-model': prov('openrouter/auto'),
            'chat-model-reasoning': prov('openrouter/auto'),
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
            'chat-model-reasoning': prov('deepseek-chat'),
            'title-model': prov('deepseek-chat'),
            'artifact-model': prov('deepseek-chat'),
          },
        });
      }
    } catch (e) {
      console.warn('[CHAT ROUTE] Env-based provider fallback failed:', e);
    }

    console.log(
      '[CHAT ROUTE] No AI config or env keys found; defaulting to xAI (may fail without key)',
    );
    return customProvider({
      languageModels: {
        'chat-model': xai('grok-2-vision-1212'),
        'chat-model-reasoning': xai('grok-3-mini-beta'),
        'title-model': xai('grok-2-1212'),
        'artifact-model': xai('grok-2-1212'),
      },
      imageModels: {
        'small-model': xai.imageModel('grok-2-image'),
      },
    });
  }

  if (adminConfig) {
    // Create provider based on admin configuration
    console.log(
      '[CHAT ROUTE] Creating provider for admin config:',
      adminConfig.provider,
    );
    let make: any = null;
    switch (adminConfig.provider) {
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
          apiKey: process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || '',
          baseURL: 'https://api.deepseek.com',
        });
        break;
      case 'xai':
      default:
        make = xai;
        break;
    }
    const chatModelId = adminConfig.chatModel;
    const reasoningModelId =
      adminConfig.reasoningModel || adminConfig.chatModel;
    return customProvider({
      languageModels: {
        'chat-model': make(chatModelId),
        'chat-model-reasoning': make(reasoningModelId),
        'title-model': make(chatModelId),
        'artifact-model': make(chatModelId),
      },
      imageModels:
        adminConfig.provider === 'xai'
          ? { 'small-model': xai.imageModel('grok-2-image') }
          : undefined,
    });
  }
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

    // Enforce clear separation of modes:
    // - Guest (not logged-in regular): must provide own API key via ai_config cookie
    // - Logged-in with active membership: can use global admin model (env keys)
    // - Logged-in without membership: must provide own key (cookie or saved integration); no env fallback

    const isRegularUser = authData.session.userType === 'regular';
    const cookieStoreForAuth = await cookies();
    const aiConfigCookie = cookieStoreForAuth.get('ai_config');

    let isMember = false;
    if (isRegularUser) {
      try {
        isMember = await hasActiveSubscription(authData.user.id);
      } catch (_) {
        isMember = false;
      }
    }

    if (!isRegularUser) {
      // Guest mode strictly requires client-provided API key
      if (!aiConfigCookie?.value) {
        return new Response(
          JSON.stringify({
            error: 'api_key_required',
            message:
              'Bitte hinterlege einen eigenen AI API-Schlüssel in den Einstellungen, um als Gast chatten zu können.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      try {
        const cfg = JSON.parse(aiConfigCookie.value);
        if (!cfg?.apiKey || !cfg?.provider || !cfg?.model) {
          return new Response(
            JSON.stringify({
              error: 'api_key_required',
              message:
                'Ungültige AI-Konfiguration. Bitte Provider, Modell und API-Schlüssel hinterlegen.',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          );
        }
      } catch {
        return new Response(
          JSON.stringify({
            error: 'api_key_required',
            message:
              'AI-Konfiguration konnte nicht gelesen werden. Bitte erneut speichern.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
    } else if (!isMember) {
      // Regular user without membership: require either cookie or a saved integration
      let hasDbIntegration = false;
      try {
        const latest = await getLatestAIIntegrationByUserId(authData.user.id);
        hasDbIntegration = !!latest;
      } catch {
        hasDbIntegration = false;
      }
      if (!aiConfigCookie?.value && !hasDbIntegration) {
        return new Response(
          JSON.stringify({
            error: 'api_key_required',
            message:
              'Bitte hinterlege einen eigenen AI API-Schlüssel (Cookie oder gespeicherte Integration), da keine Mitgliedschaft aktiv ist.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
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
          model: dynamicProvider!.languageModel(selectedChatModel),
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
