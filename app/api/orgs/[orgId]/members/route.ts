import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { addOrgMember, getUserOrganizations, listOrgMembers } from '@/lib/db/queries';

export async function GET(_req: Request, context: any) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = context?.params?.orgId as string;
  // Ensure requester is a member
  const orgs = await getUserOrganizations(session.user.id);
  if (!orgs.some((o) => o.orgId === orgId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const items = await listOrgMembers(orgId);
  return NextResponse.json({ items });
}

export async function POST(req: Request, context: any) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = context?.params?.orgId as string;
  const orgs = await getUserOrganizations(session.user.id);
  const me = orgs.find((o) => o.orgId === orgId);
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!['owner', 'admin'].includes(me.role)) return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  const role = (body?.role as string) || 'viewer';
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });
  if (!['admin', 'editor', 'viewer'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  const member = await addOrgMember({ orgId, email, role: role as any });
  return NextResponse.json({ member }, { status: 201 });
}
