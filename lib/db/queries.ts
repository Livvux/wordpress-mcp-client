import 'server-only';
import { DB_ENABLED } from '@/lib/config';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  message,
  vote,
  type DBMessage,
  type Chat,
  stream,
  aiIntegration,
  wordpressConnection,
  deviceLink,
  subscription,
  globalAIConfig,
  account as accountTable,
} from './schema';
import type { ArtifactKind } from '@/components/artifact';
import { generateUUID } from '../utils';
import { generateHashedPassword } from './utils';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '../errors';
import { decryptSecret, encryptSecret } from '../crypto';
import {
  organization,
  organizationMember,
  type Organization,
} from './schema';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

const client =
  DB_ENABLED && process.env.POSTGRES_URL
    ? postgres(process.env.POSTGRES_URL)
    : null;
const db = client
  ? drizzle(client)
  : (null as unknown as ReturnType<typeof drizzle>);

function ensureDb() {
  if (!db) {
    throw new ChatSDKError(
      'bad_request:database',
      'Database is disabled in this mode',
    );
  }
  return db;
}

// Lazily ensure the database is ready (extension + migrations) in dev/local.
// This runs once per process and is safe to call multiple times.
let dbReadyPromise: Promise<void> | null = null;
async function ensureDbReady(): Promise<void> {
  if (!client || !db) return; // DB disabled or not configured
  if (dbReadyPromise) return dbReadyPromise;
  dbReadyPromise = (async () => {
    try {
      // Ensure pgcrypto for gen_random_uuid used by defaultRandom()
      // @ts-expect-error postgres client has unsafe
      await client.unsafe?.('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    } catch (err) {
      console.warn('Warning: failed ensuring pgcrypto extension:', err);
    }
    try {
      await migrate(db as any, { migrationsFolder: './lib/db/migrations' });
    } catch (err) {
      // If migrations cannot run at runtime (e.g., prod), continue; tables may already exist
      console.warn('Warning: failed running migrations at runtime:', err);
    }
  })();
  return dbReadyPromise;
}

function isUuid(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

async function resolveUserIdToUuid(id: string): Promise<string> {
  // If it's already a UUID, just return it
  if (isUuid(id)) return id;

  // Otherwise, try to resolve guest/legacy IDs stored as email to the DB user UUID
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, id))
    .limit(1);

  if (rows.length > 0) {
    return rows[0].id as unknown as string;
  }

  throw new ChatSDKError(
    'bad_request:database',
    `Invalid user id format: ${id}`,
  );
}

// Simplified user management - using session-based guest users
export async function getUser(email: string): Promise<Array<User>> {
  try {
    const _db = ensureDb();
    return await _db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user by email',
    );
  }
}

// Device-code onboarding helpers
function generateUserCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid confusing chars
  let s = '';
  for (let i = 0; i < 8; i++)
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function generateDeviceCode(): string {
  // UUID-ish opaque token without dashes
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
}

export async function createDeviceLinkEntry(ttlSeconds = 600) {
  await ensureDbReady();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  // opportunistically clean expired links in the background (max once/min)
  maybeCleanupExpiredDeviceLinks().catch(() => {});

  // Retry on rare unique collisions for userCode/deviceCode
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateUserCode();
    const device = generateDeviceCode();
    try {
      const [row] = await db
        .insert(deviceLink)
        .values({
          userCode: code,
          deviceCode: device,
          expiresAt,
          status: 'pending',
        })
        .returning();
      return row;
    } catch (err: any) {
      const message = String(err?.message || '');
      const code = String((err && (err.code as any)) || '');
      const isUniqueViolation = code === '23505' || /unique/i.test(message);
      if (!isUniqueViolation) throw err;
      // Try again with new codes
      if (attempt === maxAttempts - 1) throw err;
    }
  }
  // Should be unreachable
  throw new ChatSDKError(
    'bad_request:device_link',
    'Failed to create device link',
  );
}

export async function approveDeviceLinkByUserCode({
  userCode,
  siteUrl,
  jwt,
  writeMode,
  pluginVersion,
}: {
  userCode: string;
  siteUrl: string;
  jwt: string;
  writeMode?: boolean;
  pluginVersion?: string | null;
}) {
  await ensureDbReady();
  // opportunistic cleanup
  maybeCleanupExpiredDeviceLinks().catch(() => {});
  const now = new Date();
  const links = await db
    .select()
    .from(deviceLink)
    .where(eq(deviceLink.userCode, userCode))
    .limit(1);
  if (links.length === 0) {
    throw new ChatSDKError(
      'bad_request:device_link',
      'Invalid or expired code',
    );
  }
  const link = links[0] as any;
  if (new Date(link.expiresAt) < now) {
    throw new ChatSDKError('bad_request:device_link', 'Code expired');
  }
  if (link.status !== 'pending') {
    throw new ChatSDKError('bad_request:device_link', 'Code already used');
  }
  const jwtEncrypted = encryptSecret(jwt);
  await db
    .update(deviceLink)
    .set({
      status: 'approved',
      approvedAt: now,
      siteUrl,
      jwtEncrypted,
      writeMode: !!writeMode,
      pluginVersion: pluginVersion ?? null,
    })
    .where(eq(deviceLink.id, link.id));
  return { ok: true } as const;
}

export async function getDeviceLinkByDeviceCode(deviceCodeValue: string) {
  await ensureDbReady();
  // opportunistic cleanup
  maybeCleanupExpiredDeviceLinks().catch(() => {});
  const links = await db
    .select()
    .from(deviceLink)
    .where(eq(deviceLink.deviceCode, deviceCodeValue))
    .limit(1);
  return links.length ? (links[0] as any) : null;
}

export async function consumeDeviceLink({
  deviceCode: deviceCodeValue,
  userId,
}: {
  deviceCode: string;
  userId: string;
}) {
  await ensureDbReady();
  // opportunistic cleanup
  maybeCleanupExpiredDeviceLinks().catch(() => {});
  const links = await db
    .select()
    .from(deviceLink)
    .where(eq(deviceLink.deviceCode, deviceCodeValue))
    .limit(1);
  if (!links.length)
    throw new ChatSDKError('bad_request:device_link', 'Not found');
  const link = links[0] as any;
  const now = new Date();
  if (new Date(link.expiresAt) < now) {
    throw new ChatSDKError('bad_request:device_link', 'Code expired');
  }
  if (link.status !== 'approved') {
    throw new ChatSDKError('bad_request:device_link', 'Not approved yet');
  }

  // Enforce plan limits: free users can have only 1 site; Pro/Admin unlimited
  // We check before inserting a new siteUrl for the user
  try {
    const existing = await db
      .select({ id: wordpressConnection.id })
      .from(wordpressConnection)
      .where(
        and(
          eq(wordpressConnection.userId, userId),
          eq(wordpressConnection.siteUrl, link.siteUrl),
        ),
      )
      .limit(1);
    if (!existing.length) {
      // It's a new site. Count how many the user already has.
      const rows = await db
        .select({ id: wordpressConnection.id })
        .from(wordpressConnection)
        .where(eq(wordpressConnection.userId, userId));

      // Determine entitlement: active subscription or admin role bypasses limit
      let unlimited = false;
      try {
        // Best-effort: if subscriptions table exists and entry active
        const hasSub = await hasActiveSubscription(userId);
        if (hasSub) unlimited = true;
      } catch {}
      if (!unlimited) {
        try {
          const { computeUserRoles } = await import('../rbac');
          const roles = await computeUserRoles({ userId });
          if (roles.includes('admin') || roles.includes('owner'))
            unlimited = true;
        } catch {}
      }

      if (!unlimited && rows.length >= 1) {
        throw new ChatSDKError(
          'payment_required:api',
          'Free plan supports only 1 connected site. Upgrade to add more.',
        );
      }
    }
  } catch (err) {
    if (err instanceof ChatSDKError) throw err;
    // If RBAC/subscription checks fail, proceed (fail-open) to avoid blocking
  }

  // Persist the connection for this user
  if (!link.siteUrl || !link.jwtEncrypted) {
    throw new ChatSDKError(
      'bad_request:device_link',
      'Missing connection data',
    );
  }
  const jwt = decryptSecret(link.jwtEncrypted);
  await upsertWordPressConnection({
    userId,
    siteUrl: link.siteUrl,
    jwt,
    writeMode: !!link.writeMode,
  });

  await db
    .update(deviceLink)
    .set({ status: 'consumed', consumedAt: now })
    .where(eq(deviceLink.id, link.id));

  return { siteUrl: link.siteUrl, jwt, writeMode: !!link.writeMode };
}

// Lightweight background cleanup of expired device links
let lastDeviceLinkCleanup = 0;
async function maybeCleanupExpiredDeviceLinks(): Promise<void> {
  try {
    const nowMs = Date.now();
    // throttle to once per minute
    if (nowMs - lastDeviceLinkCleanup < 60_000) return;
    lastDeviceLinkCleanup = nowMs;
    // Delete any rows past expiration
    await db.delete(deviceLink).where(lt(deviceLink.expiresAt, new Date()));
  } catch (err) {
    console.warn('[deviceLink] cleanup failed:', err);
  }
}

export async function getOrCreateGuestUser(guestId: string): Promise<User> {
  try {
    await ensureDbReady();
    const safeGuestId =
      typeof guestId === 'string' && guestId.trim().length > 0
        ? guestId
        : `guest-${Date.now()}`;
    // Check if guest user exists
    const _db = ensureDb();
    const existingUsers = await _db
      .select()
      .from(user)
      .where(eq(user.email, safeGuestId));
    if (existingUsers.length > 0) {
      return existingUsers[0];
    }

    // Create new guest user with simplified approach
    const [newUser] = await _db
      .insert(user)
      .values({
        email: safeGuestId,
        password: null,
      })
      .returning();

    return newUser;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? 'Unknown error');
    console.error('getOrCreateGuestUser error:', error);
    throw new ChatSDKError(
      'bad_request:database',
      `Failed to get or create guest user: ${message}`,
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    const _db = ensureDb();
    return await _db.insert(user).values({ email, password: hashedPassword });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
  }
}

// Ensure a regular user exists for a given email and return it.
// If the user does not exist, create one with a null password.
export async function getOrCreateUserByEmail(email: string): Promise<User> {
  try {
    await ensureDbReady();
    const _db = ensureDb();
    const existing = await _db.select().from(user).where(eq(user.email, email));
    if (existing.length > 0) {
      return existing[0];
    }

    const [created] = await _db
      .insert(user)
      .values({ email, password: null })
      .returning();
    return created;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? 'Unknown error');
    throw new ChatSDKError(
      'bad_request:database',
      `Failed to get or create user by email: ${message}`,
    );
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const _db = ensureDb();
    const rows = await _db.select().from(user).where(eq(user.id, userId));
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get user by id');
  }
}

// OAuth Accounts linking
export async function getLinkedAccounts(userId: string) {
  try {
    const rows = await ensureDb()
      .select()
      .from(accountTable)
      .where(eq(accountTable.userId, userId));
    return rows;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to load linked accounts',
    );
  }
}

export async function unlinkAccount({
  userId,
  provider,
}: {
  userId: string;
  provider: string;
}) {
  try {
    const _db = ensureDb();
    // Ensure user won't be locked out: require either password or another account
    const [u] = await _db.select().from(user).where(eq(user.id, userId)).limit(1);
    const accounts = await _db
      .select()
      .from(accountTable)
      .where(eq(accountTable.userId, userId));

    const remaining = accounts.filter((a) => a.provider !== provider);
    const hasPassword = !!u?.password;
    if (!hasPassword && remaining.length === 0) {
      throw new ChatSDKError(
        'bad_request:auth',
        'Cannot remove the last sign-in method.',
      );
    }

    await _db
      .delete(accountTable)
      .where(and(eq(accountTable.userId, userId), eq(accountTable.provider, provider)));
  } catch (error) {
    if (error instanceof ChatSDKError) throw error;
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to unlink account',
    );
  }
}

export async function updateUserPassword(userId: string, newPassword: string) {
  try {
    const _db = ensureDb();
    const hashed = generateHashedPassword(newPassword);
    await _db.update(user).set({ password: hashed }).where(eq(user.id, userId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update user password',
    );
  }
}

export async function deleteUserAccountCascade(userId: string) {
  try {
    const _db = ensureDb();
    // Delete votes/messages/streams/chats for user
    const userChats = await _db
      .select()
      .from(chat)
      .where(eq(chat.userId, userId));
    const chatIds = userChats.map((c) => c.id);
    if (chatIds.length > 0) {
      await _db.delete(vote).where(inArray(vote.chatId, chatIds));
      await _db.delete(message).where(inArray(message.chatId, chatIds));
      await _db.delete(stream).where(inArray(stream.chatId, chatIds));
      await _db.delete(chat).where(inArray(chat.id, chatIds));
    }

    // Delete suggestions authored by user
    await _db.delete(suggestion).where(eq(suggestion.userId, userId));

    // Delete documents by user
    await _db.delete(document).where(eq(document.userId, userId));

    // Delete integrations and connections
    await _db.delete(aiIntegration).where(eq(aiIntegration.userId, userId));
    await _db
      .delete(wordpressConnection)
      .where(eq(wordpressConnection.userId, userId));

    // Finally delete user
    await _db.delete(user).where(eq(user.id, userId));
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to delete user');
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create guest user',
    );
  }
}

// Organizations
export async function getUserOrganizations(userId: string) {
  const _db = ensureDb();
  try {
    const rows = await _db
      .select({
        orgId: organization.id,
        name: organization.name,
        role: organizationMember.role,
        membershipId: organizationMember.id,
      })
      .from(organizationMember)
      .leftJoin(
        organization,
        eq(organizationMember.orgId, organization.id),
      )
      .where(eq(organizationMember.userId, userId));
    return rows;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to load organizations');
  }
}

export async function createOrganization({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const _db = ensureDb();
  try {
    const [org] = await _db
      .insert(organization)
      .values({ name })
      .returning({ id: organization.id, name: organization.name });
    await _db
      .insert(organizationMember)
      .values({ orgId: org.id as any, userId, role: 'owner' });
    return org;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create organization');
  }
}

export async function listOrgMembers(orgId: string) {
  const _db = ensureDb();
  try {
    const rows = await _db
      .select({
        membershipId: organizationMember.id,
        userId: organizationMember.userId,
        role: organizationMember.role,
        email: user.email,
      })
      .from(organizationMember)
      .leftJoin(user, eq(user.id, organizationMember.userId))
      .where(eq(organizationMember.orgId, orgId));
    return rows;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to list members');
  }
}

export async function addOrgMember({
  orgId,
  email,
  role,
}: {
  orgId: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}) {
  const _db = ensureDb();
  try {
    const target = await getOrCreateUserByEmail(email);
    // Upsert membership
    const existing = await _db
      .select({ id: organizationMember.id })
      .from(organizationMember)
      .where(
        and(
          eq(organizationMember.orgId, orgId),
          eq(organizationMember.userId, target.id),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      await _db
        .update(organizationMember)
        .set({ role })
        .where(eq(organizationMember.id, existing[0].id as any));
      return { userId: target.id, role };
    }
    const [row] = await _db
      .insert(organizationMember)
      .values({ orgId, userId: target.id, role })
      .returning();
    return row;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to add member');
  }
}

export async function updateOrgMemberRole({
  membershipId,
  role,
}: {
  membershipId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
}) {
  const _db = ensureDb();
  try {
    await _db
      .update(organizationMember)
      .set({ role })
      .where(eq(organizationMember.id, membershipId as any));
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to update role');
  }
}

export async function removeOrgMember({
  membershipId,
}: {
  membershipId: string;
}) {
  const _db = ensureDb();
  try {
    await _db
      .delete(organizationMember)
      .where(eq(organizationMember.id, membershipId as any));
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to remove member');
  }
}

export async function deleteOrganization({ orgId }: { orgId: string }) {
  const _db = ensureDb();
  try {
    await _db.delete(organizationMember).where(eq(organizationMember.orgId, orgId));
    await _db.delete(organization).where(eq(organization.id, orgId));
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to delete organization');
  }
}

// Subscriptions
// Subscription helpers are not included in OSS lite

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
      })
      .from(subscription)
      .where(eq(subscription.userId, userId))
      .limit(1);
    if (rows.length === 0) return false;
    const { status, currentPeriodEnd } = rows[0] as any;
    const active = status === 'active';
    const notExpired =
      !currentPeriodEnd || new Date(currentPeriodEnd) > new Date();
    return active && notExpired;
  } catch {
    return false;
  }
}

// Global Admin AI Config
export async function getGlobalAIConfig() {
  try {
    const rows = await db
      .select({
        id: globalAIConfig.id,
        provider: globalAIConfig.provider,
        model: globalAIConfig.model,
        chatModel: globalAIConfig.chatModel,
        reasoningModel: globalAIConfig.reasoningModel,
        updatedAt: globalAIConfig.updatedAt,
      })
      .from(globalAIConfig)
      .orderBy(desc(globalAIConfig.updatedAt))
      .limit(1);
    if (rows.length === 0) return null;
    const row = rows[0] as any;
    return {
      id: row.id,
      provider: row.provider,
      // Backward compatibility: prefer chatModel, fall back to legacy model
      chatModel: row.chatModel ?? row.model,
      reasoningModel: row.reasoningModel ?? null,
      model: row.model,
      updatedAt: row.updatedAt,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to load global AI config',
    );
  }
}

export async function upsertGlobalAIConfig({
  provider,
  chatModel,
  reasoningModel,
}: { provider: string; chatModel: string; reasoningModel?: string | null }) {
  try {
    const existing = await db
      .select({ id: globalAIConfig.id })
      .from(globalAIConfig)
      .orderBy(desc(globalAIConfig.updatedAt))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(globalAIConfig)
        .set({
          provider,
          // keep legacy model in sync with chatModel for compatibility
          model: chatModel,
          chatModel,
          reasoningModel: reasoningModel ?? null,
          updatedAt: new Date(),
        })
        .where(eq(globalAIConfig.id, existing[0].id));
      return { provider, chatModel, reasoningModel: reasoningModel ?? null };
    }

    await db.insert(globalAIConfig).values({
      provider,
      model: chatModel,
      chatModel,
      reasoningModel: reasoningModel ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { provider, chatModel, reasoningModel: reasoningModel ?? null };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save global AI config',
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    // Normalize user id to UUID to avoid Postgres uuid casting errors
    const userId = await resolveUserIdToUuid(id);
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, userId))
            : eq(chat.userId, userId),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    console.error('Database error in getChatsByUserId:', error);
    throw new ChatSDKError(
      'bad_request:database',
      `Failed to get chats by user id: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get votes by chat id',
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save document');
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete documents by id after timestamp',
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save suggestions',
    );
  }
}

// AI Integration (server-side stored API keys)
export async function upsertAIIntegration({
  userId,
  provider,
  model,
  apiKey,
}: {
  userId: string;
  provider: string;
  model: string;
  apiKey: string;
}) {
  try {
    const apiKeyEncrypted = encryptSecret(apiKey);
    // Since we used a composite PK (userId, provider), emulate upsert
    const existing = await db
      .select({ userId: aiIntegration.userId })
      .from(aiIntegration)
      .where(
        and(
          eq(aiIntegration.userId, userId),
          eq(aiIntegration.provider, provider),
        ),
      );

    if (existing.length > 0) {
      await db
        .update(aiIntegration)
        .set({ model, apiKeyEncrypted, updatedAt: new Date() })
        .where(
          and(
            eq(aiIntegration.userId, userId),
            eq(aiIntegration.provider, provider),
          ),
        );
      return { userId, provider, model };
    }

    await db.insert(aiIntegration).values({
      userId,
      provider,
      model,
      apiKeyEncrypted,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { userId, provider, model };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save AI integration',
    );
  }
}

export async function getAIIntegration({
  userId,
  provider,
}: { userId: string; provider: string }) {
  try {
    const rows = await db
      .select()
      .from(aiIntegration)
      .where(
        and(
          eq(aiIntegration.userId, userId),
          eq(aiIntegration.provider, provider),
        ),
      );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      userId: row.userId,
      provider: row.provider,
      model: row.model,
      apiKey: decryptSecret(row.apiKeyEncrypted),
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to load AI integration',
    );
  }
}

export async function deleteAIIntegration({
  userId,
  provider,
}: { userId: string; provider: string }) {
  try {
    await db
      .delete(aiIntegration)
      .where(
        and(
          eq(aiIntegration.userId, userId),
          eq(aiIntegration.provider, provider),
        ),
      );
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete AI integration',
    );
  }
}

export async function getLatestAIIntegrationByUserId(userId: string) {
  try {
    const rows = await db
      .select()
      .from(aiIntegration)
      .where(eq(aiIntegration.userId, userId))
      .orderBy(desc(aiIntegration.updatedAt))
      .limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      userId: row.userId,
      provider: row.provider,
      model: row.model,
      apiKey: decryptSecret(row.apiKeyEncrypted),
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to load latest AI integration',
    );
  }
}

// WordPress connection (server-side stored JWT)
export async function upsertWordPressConnection({
  userId,
  siteUrl,
  jwt,
  writeMode,
}: {
  userId: string;
  siteUrl: string;
  jwt: string;
  writeMode: boolean;
}) {
  try {
    const jwtEncrypted = encryptSecret(jwt);
    const rows = await db
      .select({ id: wordpressConnection.id })
      .from(wordpressConnection)
      .where(
        and(
          eq(wordpressConnection.userId, userId),
          eq(wordpressConnection.siteUrl, siteUrl),
        ),
      )
      .limit(1);

    if (rows.length > 0) {
      await db
        .update(wordpressConnection)
        .set({ jwtEncrypted, writeMode, updatedAt: new Date() })
        .where(
          and(
            eq(wordpressConnection.userId, userId),
            eq(wordpressConnection.siteUrl, siteUrl),
          ),
        );
      return { userId, siteUrl, writeMode };
    }

    await db.insert(wordpressConnection).values({
      userId,
      siteUrl,
      jwtEncrypted,
      writeMode,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { userId, siteUrl, writeMode };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save WordPress connection',
    );
  }
}

export async function updateWordPressJwt({
  userId,
  siteUrl,
  jwt,
}: {
  userId: string;
  siteUrl: string;
  jwt: string;
}) {
  try {
    const jwtEncrypted = encryptSecret(jwt);
    await db
      .update(wordpressConnection)
      .set({ jwtEncrypted, updatedAt: new Date(), lastUsedAt: new Date() })
      .where(
        and(
          eq(wordpressConnection.userId, userId),
          eq(wordpressConnection.siteUrl, siteUrl),
        ),
      );
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update WordPress JWT',
    );
  }
}

export async function getWordPressConnectionByUserId(userId: string) {
  try {
    const rows = await db
      .select()
      .from(wordpressConnection)
      .where(eq(wordpressConnection.userId, userId));
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      userId: row.userId,
      siteUrl: row.siteUrl,
      jwt: decryptSecret(row.jwtEncrypted),
      writeMode: row.writeMode,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to load WordPress connection',
    );
  }
}

export async function updateWordPressWriteMode({
  userId,
  enabled,
}: { userId: string; enabled: boolean }) {
  try {
    await db
      .update(wordpressConnection)
      .set({ writeMode: enabled, updatedAt: new Date() })
      .where(eq(wordpressConnection.userId, userId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update WordPress write mode',
    );
  }
}

export async function deleteWordPressConnectionByUserId(userId: string) {
  try {
    await db
      .delete(wordpressConnection)
      .where(eq(wordpressConnection.userId, userId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete WordPress connection',
    );
  }
}

// New helpers for multi-site management
export async function listWordPressConnectionsByUserId(userId: string) {
  try {
    const rows = await db
      .select({
        userId: wordpressConnection.userId,
        siteUrl: wordpressConnection.siteUrl,
        writeMode: wordpressConnection.writeMode,
        createdAt: wordpressConnection.createdAt,
        updatedAt: wordpressConnection.updatedAt,
        lastUsedAt: wordpressConnection.lastUsedAt,
      })
      .from(wordpressConnection)
      .where(eq(wordpressConnection.userId, userId))
      .orderBy(desc(wordpressConnection.updatedAt));
    return rows as Array<{
      userId: string;
      siteUrl: string;
      writeMode: boolean;
      createdAt: Date;
      updatedAt: Date;
      lastUsedAt: Date | null;
    }>;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to list WordPress connections',
    );
  }
}

export async function getWordPressConnectionByUserAndSite({
  userId,
  siteUrl,
}: {
  userId: string;
  siteUrl: string;
}) {
  try {
    const rows = await db
      .select()
      .from(wordpressConnection)
      .where(
        and(
          eq(wordpressConnection.userId, userId),
          eq(wordpressConnection.siteUrl, siteUrl),
        ),
      )
      .limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      userId: row.userId,
      siteUrl: row.siteUrl,
      jwt: decryptSecret(row.jwtEncrypted),
      writeMode: row.writeMode,
      updatedAt: row.updatedAt,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to load WordPress connection by site',
    );
  }
}

export async function countWordPressConnectionsByUserId(userId: string) {
  try {
    const rows = await db
      .select({ id: wordpressConnection.id })
      .from(wordpressConnection)
      .where(eq(wordpressConnection.userId, userId));
    return rows.length;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to count WordPress connections',
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get suggestions by document id',
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: { id: string; differenceInHours: number }) {
  try {
    const userId = await resolveUserIdToUuid(id);
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, userId),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, 'user'),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message count by user id',
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}
