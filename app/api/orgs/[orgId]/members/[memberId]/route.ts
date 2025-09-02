import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUserOrganizations, removeOrgMember, updateOrgMemberRole } from '@/lib/db/queries';

export async function PATCH(req: Request, context: any) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = context?.params?.orgId as string;
  const membershipId = context?.params?.memberId as string;
  const orgs = await getUserOrganizations(session.user.id);
  const me = orgs.find((o) => o.orgId === orgId);
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!['owner', 'admin'].includes(me.role)) return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const role = String(body?.role || 'viewer');
  if (!['owner', 'admin', 'editor', 'viewer'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  // Only owners can assign owners
  if (role === 'owner' && me.role !== 'owner') return NextResponse.json({ error: 'Only owner can assign owner' }, { status: 403 });
  await updateOrgMemberRole({ membershipId, role: role as any });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, context: any) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = context?.params?.orgId as string;
  const membershipId = context?.params?.memberId as string;
  const orgs = await getUserOrganizations(session.user.id);
  const me = orgs.find((o) => o.orgId === orgId);
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!['owner', 'admin'].includes(me.role)) return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  await removeOrgMember({ membershipId });
  return NextResponse.json({ ok: true });
}
