import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/app/(auth)/auth-simple';
import { requireOwnerOrAdmin } from '@/lib/rbac';
import { getGlobalAIConfig, upsertGlobalAIConfig } from '@/lib/db/queries';

const schema = z.object({
  provider: z.string().min(1),
  chatModel: z.string().min(1),
  reasoningModel: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await requireOwnerOrAdmin({
      userId: session.user.id,
      email: session.user.email ?? null,
    });

    const cfg = await getGlobalAIConfig();
    return NextResponse.json({ config: cfg });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load config' },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await requireOwnerOrAdmin({
      userId: session.user.id,
      email: session.user.email ?? null,
    });

    const body = await request.json();
    const { provider, chatModel, reasoningModel } = schema.parse(body);
    const saved = await upsertGlobalAIConfig({ provider, chatModel, reasoningModel });
    return NextResponse.json({ success: true, config: saved });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to save config' },
      { status: 400 },
    );
  }
}
