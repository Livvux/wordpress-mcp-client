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
import postgres from 'postgres';

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
  subscription,
} from './schema';
import type { ArtifactKind } from '@/components/artifact';
import { generateUUID } from '../utils';
import { generateHashedPassword } from './utils';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '../errors';
import { decryptSecret, encryptSecret } from '../crypto';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

const client = DB_ENABLED && process.env.POSTGRES_URL ? postgres(process.env.POSTGRES_URL) : null;
const db = client ? drizzle(client) : null as unknown as ReturnType<typeof drizzle>;

function ensureDb() {
  if (!db) {
    throw new ChatSDKError('bad_request:database', 'Database is disabled in this mode');
  }
  return db;
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

export async function getOrCreateGuestUser(guestId: string): Promise<User> {
  try {
    // Check if guest user exists
    const _db = ensureDb();
    const existingUsers = await _db.select().from(user).where(eq(user.email, guestId));
    if (existingUsers.length > 0) {
      return existingUsers[0];
    }
    
    // Create new guest user with simplified approach
    const [newUser] = await _db
      .insert(user)
      .values({
        email: guestId,
        password: null,
      })
      .returning();
    
    return newUser;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get or create guest user',
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

// Subscriptions
export async function getSubscriptionByUserId(userId: string) {
  const _db = ensureDb();
  try {
    const [sub] = await _db.select().from(subscription).where(eq(subscription.userId, userId)).limit(1);
    return sub || null;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to fetch subscription');
  }
}

export async function upsertSubscription(params: {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  status?: string;
  currentPeriodEnd?: Date | null;
}) {
  const _db = ensureDb();
  const { userId, stripeCustomerId, stripeSubscriptionId, status, currentPeriodEnd } = params;
  try {
    const [existing] = await _db.select().from(subscription).where(eq(subscription.userId, userId)).limit(1);
    if (existing) {
      const [updated] = await _db
        .update(subscription)
        .set({
          stripeCustomerId: stripeCustomerId ?? existing.stripeCustomerId,
          stripeSubscriptionId: stripeSubscriptionId ?? existing.stripeSubscriptionId,
          status: status ?? existing.status,
          currentPeriodEnd: currentPeriodEnd ?? existing.currentPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(subscription.userId, userId))
        .returning();
      return updated;
    }
    const [inserted] = await _db
      .insert(subscription)
      .values({
        userId,
        stripeCustomerId: stripeCustomerId ?? null,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        status: status ?? 'active',
        currentPeriodEnd: currentPeriodEnd ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return inserted;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to upsert subscription');
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
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
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
      .where(and(eq(aiIntegration.userId, userId), eq(aiIntegration.provider, provider)));

    if (existing.length > 0) {
      await db
        .update(aiIntegration)
        .set({ model, apiKeyEncrypted, updatedAt: new Date() })
        .where(and(eq(aiIntegration.userId, userId), eq(aiIntegration.provider, provider)));
      return { userId, provider, model };
    }

    await db.insert(aiIntegration).values({ userId, provider, model, apiKeyEncrypted, createdAt: new Date(), updatedAt: new Date() });
    return { userId, provider, model };
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save AI integration');
  }
}

export async function getAIIntegration({ userId, provider }: { userId: string; provider: string }) {
  try {
    const rows = await db
      .select()
      .from(aiIntegration)
      .where(and(eq(aiIntegration.userId, userId), eq(aiIntegration.provider, provider)));
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      userId: row.userId,
      provider: row.provider,
      model: row.model,
      apiKey: decryptSecret(row.apiKeyEncrypted),
    };
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to load AI integration');
  }
}

export async function deleteAIIntegration({ userId, provider }: { userId: string; provider: string }) {
  try {
    await db
      .delete(aiIntegration)
      .where(and(eq(aiIntegration.userId, userId), eq(aiIntegration.provider, provider)));
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to delete AI integration');
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
    throw new ChatSDKError('bad_request:database', 'Failed to load latest AI integration');
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
    const existing = await db
      .select({ userId: wordpressConnection.userId })
      .from(wordpressConnection)
      .where(eq(wordpressConnection.userId, userId));

    if (existing.length > 0) {
      await db
        .update(wordpressConnection)
        .set({ siteUrl, jwtEncrypted, writeMode, updatedAt: new Date() })
        .where(eq(wordpressConnection.userId, userId));
      return { userId, siteUrl, writeMode };
    }

    await db.insert(wordpressConnection).values({ userId, siteUrl, jwtEncrypted, writeMode, createdAt: new Date(), updatedAt: new Date() });
    return { userId, siteUrl, writeMode };
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save WordPress connection');
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
    throw new ChatSDKError('bad_request:database', 'Failed to load WordPress connection');
  }
}

export async function updateWordPressWriteMode({ userId, enabled }: { userId: string; enabled: boolean }) {
  try {
    await db
      .update(wordpressConnection)
      .set({ writeMode: enabled, updatedAt: new Date() })
      .where(eq(wordpressConnection.userId, userId));
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to update WordPress write mode');
  }
}

export async function deleteWordPressConnectionByUserId(userId: string) {
  try {
    await db.delete(wordpressConnection).where(eq(wordpressConnection.userId, userId));
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to delete WordPress connection');
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
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
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
