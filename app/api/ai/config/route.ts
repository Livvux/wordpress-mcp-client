import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security';
import { auth } from '@/app/(auth)/auth-simple';
import {
  deleteAIIntegration,
  getAIIntegration,
  upsertAIIntegration,
} from '@/lib/db/queries';

const saveConfigSchema = z.object({
  provider: z.string(),
  apiKey: z.string(),
  model: z.string(),
});

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    console.log('[AI CONFIG API] Saving config:', {
      provider: body.provider,
      model: body.model,
      hasApiKey: !!body.apiKey,
    });

    const { provider, apiKey, model } = saveConfigSchema.parse(body);

    await upsertAIIntegration({
      userId: session.user.id,
      provider,
      model,
      apiKey,
    });

    console.log('[AI CONFIG API] Configuration saved successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving AI configuration:', error);
    return NextResponse.json(
      { error: 'Failed to save AI configuration' },
      { status: 400 },
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ config: null });
    }

    // We return only non-sensitive fields by default
    // Clients already hold the key locally if needed; server uses DB copy.
    // For UI population, omit apiKey.
    const providers = [
      'openai',
      'anthropic',
      'google',
      'openrouter',
      'deepseek',
      'xai',
    ];
    // Try to return the most recently used provider; here we pick OpenAI by default
    const provider = 'openai';
    const ai = await getAIIntegration({
      userId: session.user.id,
      provider,
    }).catch(() => null);
    if (!ai) {
      return NextResponse.json({ config: null });
    }
    return NextResponse.json({
      config: { provider: ai.provider, model: ai.model },
    });
  } catch (error) {
    console.error('Error loading AI configuration:', error);
    return NextResponse.json({ config: null });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Default to deleting OpenAI config if present (extend to accept provider if needed)
    await deleteAIIntegration({ userId: session.user.id, provider: 'openai' });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting AI configuration:', error);
    return NextResponse.json(
      { error: 'Failed to delete AI configuration' },
      { status: 400 },
    );
  }
}
