import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { unlinkAccount } from '@/lib/db/queries';

export async function DELETE(
  _req: Request,
  context: any,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const provider = context?.params?.provider as string;
  if (!provider || !['google', 'twitter'].includes(provider)) {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  }
  try {
    await unlinkAccount({ userId: session.user.id, provider });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const message = e?.message || 'Failed to unlink';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
