import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { createOrganization, getUserOrganizations } from '@/lib/db/queries';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await getUserOrganizations(session.user.id);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const org = await createOrganization({ userId: session.user.id, name });
  return NextResponse.json({ org }, { status: 201 });
}

