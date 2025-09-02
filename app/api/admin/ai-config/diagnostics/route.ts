import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth-simple';
import { requireOwnerOrAdmin } from '@/lib/rbac';
import { AI_PROVIDERS, validateApiKey } from '@/lib/ai/providers-config';
import { fetchModelsForProvider } from '@/lib/ai/model-fetcher';
import { getGlobalAIConfig } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

type ProviderId = typeof AI_PROVIDERS[number]['id'];

const PROVIDER_ENV_MAP: Record<ProviderId, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  xai: 'XAI_API_KEY',
};

function resolveApiKey(providerId: ProviderId): { key: string | null; source: string | null } {
  const specificName = PROVIDER_ENV_MAP[providerId];
  const specific = specificName ? process.env[specificName] : undefined;
  if (specific) return { key: specific, source: `env:${specificName}` };

  // Fallback: if AI_PROVIDER matches, allow AI_API_KEY
  if (process.env.AI_PROVIDER === providerId && process.env.AI_API_KEY) {
    return { key: process.env.AI_API_KEY, source: 'env:AI_API_KEY' };
  }
  return { key: null, source: null };
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await requireOwnerOrAdmin({ userId: session.user.id, email: session.user.email ?? null });

    const adminConfig = await getGlobalAIConfig().catch(() => null);

    const results = await Promise.all(
      AI_PROVIDERS.map(async (p) => {
        const { key, source } = resolveApiKey(p.id as ProviderId);
        const apiKeyPresent = !!key;
        const apiKeyLooksValid = apiKeyPresent ? validateApiKey(p.id, key!) : false;
        let reachable: boolean | null = null;
        let error: string | null = null;
        let modelsCount: number | null = null;

        if (apiKeyPresent) {
          try {
            const models = await fetchModelsForProvider(p.id, key!);
            modelsCount = models?.length ?? 0;
            reachable = true;
          } catch (e: any) {
            reachable = false;
            error = e?.message || 'Verbindungsprüfung fehlgeschlagen';
          }
        }

        const last4 = apiKeyPresent ? key!.slice(-4) : null;

        return {
          id: p.id,
          name: p.name,
          apiKeyPresent,
          apiKeyLooksValid,
          apiKeySource: source,
          apiKeyLast4: last4,
          reachable,
          error,
          modelsCount,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      adminConfig,
      providers: results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Diagnostics failed' },
      { status: 400 },
    );
  }
}

