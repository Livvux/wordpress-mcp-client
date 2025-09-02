'use server';

import 'server-only';
import { DB_ENABLED } from '@/lib/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ChatSDKError } from '@/lib/errors';
import { organizationMember } from '@/lib/db/schema';

export type AppRole = 'owner' | 'admin' | 'editor' | 'viewer';

function parseAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function getDb() {
  if (!DB_ENABLED || !process.env.POSTGRES_URL) return null;
  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client);
  return { client, db } as const;
}

export async function getOrgRolesForUser(userId: string): Promise<AppRole[]> {
  const conn = await getDb();
  if (!conn) return [];
  const { client, db } = conn;
  try {
    const rows = await db
      .select({ role: organizationMember.role })
      .from(organizationMember)
      .where(eq(organizationMember.userId, userId));
    const roles = Array.from(
      new Set(rows.map((r) => (r.role as AppRole) || 'viewer')),
    );
    return roles as AppRole[];
  } finally {
    await client.end();
  }
}

export async function computeUserRoles(opts: {
  userId?: string;
  email?: string | null;
}): Promise<AppRole[]> {
  const roles = new Set<AppRole>();

  const adminEmails = parseAdminEmails();
  if (opts.email && adminEmails.has(opts.email.toLowerCase())) {
    roles.add('admin');
  }

  if (opts.userId) {
    try {
      const orgRoles = await getOrgRolesForUser(opts.userId);
      // Keep organization roles, but do NOT add org-level 'admin' as app-level 'admin'
      orgRoles
        .filter((r) => r !== 'admin')
        .forEach((r) => roles.add(r));
    } catch (_) {
      // ignore DB issues; roles remain as-is
    }
  }

  if (roles.size === 0) roles.add('viewer');
  return Array.from(roles);
}

// App-level admin: only via ADMIN_EMAILS
export async function hasOwnerOrAdmin(
  _roles?: string[] | null,
  email?: string | null,
): Promise<boolean> {
  if (!email) return false;
  const admins = parseAdminEmails();
  return admins.has(email.toLowerCase());
}

export async function ensureRole(
  required: AppRole | AppRole[],
  opts: { userId?: string; email?: string | null },
): Promise<boolean> {
  const roles = await computeUserRoles(opts);
  const req = Array.isArray(required) ? required : [required];
  return req.some((r) => roles.includes(r));
}

export async function requireRole(
  required: AppRole | AppRole[],
  opts: { userId?: string; email?: string | null },
): Promise<void> {
  const ok = await ensureRole(required, opts);
  if (!ok) {
    throw new ChatSDKError('forbidden:auth', 'Insufficient privileges');
  }
}

export async function requireOwnerOrAdmin(opts: {
  userId?: string;
  email?: string | null;
}): Promise<void> {
  const ok = await hasOwnerOrAdmin(undefined, opts.email ?? null);
  if (!ok) {
    throw new ChatSDKError('forbidden:auth', 'Insufficient privileges');
  }
}
