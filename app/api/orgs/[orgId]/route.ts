import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { deleteOrganization, getUserOrganizations } from '@/lib/db/queries';

export async function DELETE(_req: Request, context: any) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = context?.params?.orgId as string;
  const orgs = await getUserOrganizations(session.user.id);
  const me = orgs.find((o) => o.orgId === orgId);
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (me.role !== 'owner') return NextResponse.json({ error: 'Only owner can delete org' }, { status: 403 });
  await deleteOrganization({ orgId });
  return NextResponse.json({ ok: true });
}
